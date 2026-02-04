import { PDFDocument, PDFName, PDFBool } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";

// Configurar el worker de pdf.js
// Usar unpkg que siempre tiene las versiones de npm disponibles
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

/**
 * Extrae texto cercano a un campo del formulario usando pdf.js
 * Similar al script de Python, busca texto visible cerca del campo
 * @param {ArrayBuffer} pdfBytes - Bytes del PDF
 * @param {number} pageIndex - Índice de la página (0-based)
 * @param {Array} rect - Rectángulo del campo [llx, lly, urx, ury] en coordenadas PDF
 * @returns {Promise<{text: string, position: {x: number, y: number}}>} Texto encontrado cerca del campo y su posición
 */
async function extractNearbyText(pdfBytes, pageIndex, rect) {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    
    // pageIndex viene en formato 0-based, pero pdf.js usa 1-based
    if (pageIndex >= pdf.numPages || pageIndex < 0) {
      return { text: "", position: null };
    }

    // pdf.js espera índices 1-based (primera página = 1, no 0)
    const page = await pdf.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;

    // Convertir coordenadas PDF (bottom-left origin) a coordenadas de viewport (top-left origin)
    const [llx, lly, urx, ury] = rect;
    const fieldRect = {
      x0: llx,
      y0: pageHeight - ury, // Convertir Y
      x1: urx,
      y1: pageHeight - lly, // Convertir Y
    };

    // Área de búsqueda: extender hacia la izquierda (donde suelen estar los labels)
    const searchRect = {
      x0: Math.max(0, fieldRect.x0 - 250), // Extender 250 puntos a la izquierda
      y0: Math.max(0, fieldRect.y0 - 20),  // Un poco arriba
      x1: fieldRect.x1,
      y1: Math.min(pageHeight, fieldRect.y1 + 20), // Un poco abajo
    };

    // Extraer texto de la página
    const textContent = await page.getTextContent();
    
    // Filtrar items de texto que estén en el área de búsqueda
    const nearbyTexts = [];
    for (const item of textContent.items) {
      if (item.str && item.transform) {
        // item.transform[5] es la coordenada Y (top-left origin)
        // item.transform[4] es la coordenada X
        const x = item.transform[4];
        const y = item.transform[5];
        
        if (
          x >= searchRect.x0 &&
          x <= searchRect.x1 &&
          y >= searchRect.y0 &&
          y <= searchRect.y1
        ) {
          nearbyTexts.push({
            text: item.str.trim(),
            x: x,
            y: y,
          });
        }
      }
    }

    if (nearbyTexts.length === 0) {
      return { text: "", position: null };
    }

    // Ordenar por posición (de arriba a abajo, luego de izquierda a derecha)
    nearbyTexts.sort((a, b) => {
      const dy = Math.abs(a.y - fieldRect.y0) - Math.abs(b.y - fieldRect.y0);
      if (Math.abs(dy) > 5) {
        return dy;
      }
      // Si están a la misma altura, priorizar el que esté más cerca del borde izquierdo del campo
      return Math.abs(fieldRect.x0 - a.x) - Math.abs(fieldRect.x0 - b.x);
    });

    // Tomar el texto más cercano (normalmente el label)
    const bestMatch = nearbyTexts[0];
    
    // Limpiar el texto (eliminar espacios múltiples, etc.)
    let label = bestMatch.text.replace(/\s+/g, " ").trim();
    
    // Si hay múltiples líneas cercanas, combinarlas (hasta 2 líneas)
    if (nearbyTexts.length > 1) {
      const second = nearbyTexts[1];
      // Si la segunda línea está cerca verticalmente, podría ser parte del label
      if (Math.abs(second.y - bestMatch.y) < 15) {
        label = `${label} ${second.text}`.replace(/\s+/g, " ").trim();
      }
    }

    return {
      text: label,
      position: {
        x: Math.round(bestMatch.x),
        y: Math.round(bestMatch.y),
      }
    };
  } catch (error) {
    console.warn("Error al extraer texto cercano:", error);
    return { text: "", position: null };
  }
}

/**
 * Obtiene las coordenadas de todos los campos de formulario usando pdf.js
 * pdf.js tiene mejor acceso a las anotaciones Widget que pdf-lib
 * IMPORTANTE: Detecta TODOS los widgets, incluso múltiples del mismo campo (ej: IBAN con 24 casillas)
 * @param {ArrayBuffer} pdfBytes - Bytes del PDF
 * @returns {Promise<{coordinatesMap: Map, allWidgets: Array}>} Mapa de fieldName a coordenadas y lista de todos los widgets
 */
async function getFieldCoordinatesWithPdfJs(pdfBytes) {
  const coordinatesMap = new Map();
  const allWidgets = []; // Lista de TODOS los widgets individuales
  
  try {
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    
    console.log(`📐 Extrayendo coordenadas con pdf.js de ${pdf.numPages} páginas...`);
    
    let totalAnnotations = 0;
    let totalWidgets = 0;
    let widgetIndex = 0;
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const annotations = await page.getAnnotations();
      
      totalAnnotations += annotations.length;
      
      // Log de tipos de anotaciones en la primera página
      if (pageNum === 1 && annotations.length > 0) {
        const subtypes = [...new Set(annotations.map(a => a.subtype))];
        console.log(`  Página 1: ${annotations.length} anotaciones, tipos: ${subtypes.join(", ")}`);
        
        // Log de estructura de la primera anotación Widget
        const firstWidget = annotations.find(a => a.subtype === 'Widget');
        if (firstWidget) {
          console.log(`  Ejemplo de Widget:`, {
            subtype: firstWidget.subtype,
            fieldName: firstWidget.fieldName,
            fieldType: firstWidget.fieldType,
            id: firstWidget.id,
            title: firstWidget.title,
            rect: firstWidget.rect,
            hasRect: !!firstWidget.rect,
          });
        }
      }
      
      // Filtrar solo widgets (campos de formulario)
      const widgets = annotations.filter(a => a.subtype === 'Widget');
      totalWidgets += widgets.length;
      
      for (const widget of widgets) {
        // El nombre del campo puede estar en fieldName o en el título
        const fieldName = widget.fieldName || widget.title || widget.id;
        
        if (widget.rect) {
          // rect es [x1, y1, x2, y2] en coordenadas PDF (bottom-left origin)
          const [x1, y1, x2, y2] = widget.rect;
          
          const widgetData = {
            page: pageNum,
            rect: widget.rect,
            x: Math.round(x1),
            y: Math.round(y1),
            width: Math.round(x2 - x1),
            height: Math.round(y2 - y1),
            fieldName: fieldName || `widget_${widgetIndex}`,
            fieldType: widget.fieldType,
            widgetIndex: widgetIndex,
          };
          
          // Agregar a allWidgets (TODOS los widgets)
          allWidgets.push(widgetData);
          
          // Agregar al mapa (solo el primero de cada fieldName, para compatibilidad)
          if (fieldName && !coordinatesMap.has(fieldName)) {
            coordinatesMap.set(fieldName, widgetData);
          }
          
          widgetIndex++;
        }
      }
    }
    
    console.log(`📊 Resumen pdf.js: ${totalAnnotations} anotaciones, ${totalWidgets} widgets totales`);
    console.log(`✓ pdf.js encontró ${allWidgets.length} widgets individuales, ${coordinatesMap.size} nombres únicos`);
    
    // Log de algunos ejemplos
    if (allWidgets.length > 0) {
      const examples = allWidgets.slice(0, 5);
      examples.forEach((w) => {
        console.log(`  - "${w.fieldName}": Pág.${w.page} X:${w.x} Y:${w.y} (${w.width}x${w.height})`);
      });
      if (allWidgets.length > 5) {
        console.log(`  ... y ${allWidgets.length - 5} más`);
      }
    } else {
      console.warn("⚠️ pdf.js no encontró ningún widget con coordenadas");
    }
    
    return { coordinatesMap, allWidgets };
  } catch (error) {
    console.error("Error al extraer coordenadas con pdf.js:", error);
    return { coordinatesMap, allWidgets };
  }
}

/**
 * Obtiene el rectángulo y página de un campo
 * Los campos AcroForm pueden tener coordenadas en el campo mismo o en sus widgets
 * @param {Object} field - Campo de pdf-lib
 * @param {PDFDocument} pdfDoc - Documento PDF
 * @returns {Object} { rect: [llx, lly, urx, ury], pageIndex: number } o null
 */
function getFieldRectAndPage(field, pdfDoc) {
  try {
    const fieldName = field.getName();
    const acroField = field.acroField;
    
    if (!acroField || !acroField.dict) {
      console.warn(`Campo ${fieldName}: No tiene acroField o dict`);
      return null;
    }

    let rect = null;
    let pageRef = null;

    // Estrategia 1: Intentar usar getWidgets() si está disponible (método más directo de pdf-lib)
    try {
      if (typeof acroField.getWidgets === 'function') {
        const widgets = acroField.getWidgets();
        if (widgets && widgets.length > 0) {
          const firstWidget = widgets[0];
          if (firstWidget && firstWidget.dict) {
            // Intentar obtener Rect del widget
            const widgetRect = firstWidget.dict.get(PDFName.of("Rect"));
            if (widgetRect && Array.isArray(widgetRect) && widgetRect.length === 4) {
              rect = widgetRect;
              console.log(`✓ Campo ${fieldName}: Rect encontrado en widget (método getWidgets)`);
            }
            
            // Intentar obtener P (página) del widget
            const widgetPageRef = firstWidget.dict.get(PDFName.of("P"));
            if (widgetPageRef) {
              pageRef = widgetPageRef;
              console.log(`✓ Campo ${fieldName}: Página encontrada en widget (método getWidgets)`);
            }
          }
        }
      }
    } catch (e) {
      console.log(`Campo ${fieldName}: getWidgets() no disponible o falló:`, e.message);
    }

    // Estrategia 2: Intentar obtener Rect y P directamente del campo
    if (!rect || !pageRef) {
      try {
        const directRect = acroField.dict.get(PDFName.of("Rect"));
        if (directRect && Array.isArray(directRect) && directRect.length === 4) {
          rect = directRect;
          console.log(`✓ Campo ${fieldName}: Rect encontrado directamente en campo`);
        }
        
        const directPageRef = acroField.dict.get(PDFName.of("P"));
        if (directPageRef) {
          pageRef = directPageRef;
          console.log(`✓ Campo ${fieldName}: Página encontrada directamente en campo`);
        }
      } catch (e) {
        console.log(`Campo ${fieldName}: No se pudo obtener Rect/P directamente:`, e.message);
      }
    }

    // Estrategia 3: Si no están en el campo, buscar en los widgets (Kids) manualmente
    if ((!rect || !pageRef) && acroField.dict) {
      try {
        const kids = acroField.dict.get(PDFName.of("Kids"));
        if (kids) {
          // Kids puede ser un array o un objeto con métodos
          let kidsArray = null;
          
          if (Array.isArray(kids)) {
            kidsArray = kids;
          } else if (kids && typeof kids.asArray === 'function') {
            // Algunas versiones de pdf-lib exponen Kids como un objeto con asArray()
            kidsArray = kids.asArray();
          } else if (kids && typeof kids.toArray === 'function') {
            kidsArray = kids.toArray();
          }
          
          if (kidsArray && kidsArray.length > 0) {
            // Iterar sobre todos los widgets para encontrar uno con Rect y P
            for (const widget of kidsArray) {
              if (!widget) continue;
              
              // El widget puede ser una referencia o un objeto con dict
              let widgetDict = null;
              if (widget.dict) {
                widgetDict = widget.dict;
              } else if (widget && typeof widget === 'object') {
                // Intentar acceder directamente
                widgetDict = widget;
              }
              
              if (widgetDict) {
                try {
                  if (!rect) {
                    const widgetRect = widgetDict.get(PDFName.of("Rect"));
                    if (widgetRect && Array.isArray(widgetRect) && widgetRect.length === 4) {
                      rect = widgetRect;
                      console.log(`✓ Campo ${fieldName}: Rect encontrado en widget (Kids)`);
                    }
                  }
                  
                  if (!pageRef) {
                    const widgetPageRef = widgetDict.get(PDFName.of("P"));
                    if (widgetPageRef) {
                      pageRef = widgetPageRef;
                      console.log(`✓ Campo ${fieldName}: Página encontrada en widget (Kids)`);
                    }
                  }
                  
                  // Si ya tenemos ambos, no necesitamos seguir buscando
                  if (rect && pageRef) {
                    break;
                  }
                } catch (e) {
                  // Continuar con el siguiente widget
                  continue;
                }
              }
            }
          }
        }
      } catch (e) {
        console.log(`Campo ${fieldName}: Error al buscar en widgets (Kids):`, e.message);
      }
    }

    // Validar que tenemos un Rect válido
    if (!rect || !Array.isArray(rect) || rect.length !== 4) {
      console.warn(`Campo ${fieldName}: No se encontró Rect válido después de todas las estrategias`);
      // Log adicional para debugging
      try {
        console.log(`  - acroField.dict keys:`, Object.keys(acroField.dict || {}));
        if (acroField.dict) {
          const kids = acroField.dict.get(PDFName.of("Kids"));
          console.log(`  - Kids existe:`, !!kids, `tipo:`, typeof kids);
        }
      } catch (e) {
        // Ignorar errores de logging
      }
      return null;
    }

    // Validar que tenemos una referencia de página
    if (!pageRef) {
      console.warn(`Campo ${fieldName}: No se encontró referencia de página (P) después de todas las estrategias`);
      return null;
    }

    // Buscar el índice de la página
    const pages = pdfDoc.getPages();
    let pageIndex = null;
    
    // Intentar múltiples formas de comparar la referencia de página
    try {
      // Método 1: Comparación directa de referencias
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        if (page.ref === pageRef || page.node === pageRef) {
          pageIndex = i;
          break;
        }
      }

      // Método 2: Comparación por string
      if (pageIndex === null) {
        const pageRefStr = String(pageRef);
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const pageRefStr2 = page.ref ? String(page.ref) : null;
          const pageNodeStr = page.node ? String(page.node) : null;
          
          if (pageRefStr2 === pageRefStr || pageNodeStr === pageRefStr) {
            pageIndex = i;
            break;
          }
        }
      }

      // Método 3: Si pageRef tiene una propiedad objectNumber, comparar por eso
      if (pageIndex === null && pageRef.objectNumber !== undefined) {
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          if (page.ref && page.ref.objectNumber === pageRef.objectNumber) {
            pageIndex = i;
            break;
          }
        }
      }
      
      // Método 4: Comparar por toString() si está disponible
      if (pageIndex === null) {
        try {
          const pageRefStr = pageRef.toString();
          for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            if (page.ref && page.ref.toString() === pageRefStr) {
              pageIndex = i;
              break;
            }
          }
        } catch (e) {
          // Ignorar
        }
      }
    } catch (e) {
      console.warn(`Campo ${fieldName}: Error al buscar índice de página:`, e.message);
    }

    if (pageIndex === null) {
      console.warn(`Campo ${fieldName}: No se pudo encontrar el índice de página para la referencia:`, pageRef);
      // Log adicional para debugging
      try {
        console.log(`  - Tipo de pageRef:`, typeof pageRef);
        console.log(`  - pageRef.toString():`, String(pageRef));
        console.log(`  - pageRef.objectNumber:`, pageRef.objectNumber);
        console.log(`  - Total de páginas:`, pages.length);
        if (pages.length > 0) {
          console.log(`  - Primera página ref:`, pages[0].ref);
          console.log(`  - Primera página node:`, pages[0].node);
        }
      } catch (e) {
        // Ignorar errores de logging
      }
      return null;
    }

    console.log(`✓ Coordenadas encontradas para campo ${fieldName}: rect=[${rect.join(', ')}], página=${pageIndex + 1}`);

    return {
      rect: [rect[0], rect[1], rect[2], rect[3]],
      pageIndex: pageIndex,
    };
  } catch (e) {
    console.error(`Error en getFieldRectAndPage para campo ${field.getName()}:`, e);
    return null;
  }
}

/**
 * Obtiene los campos de un formulario PDF (AcroForm)
 * @param {ArrayBuffer} pdfBytes - Bytes del PDF
 * @param {Object} options - Opciones
 * @param {boolean} options.extractNearbyText - Si extraer texto cercano usando pdf.js (default: true)
 * @returns {Promise<Array>} Array de objetos con información de los campos
 */
export async function getPdfFields(pdfBytes, options = {}) {
  const { extractNearbyText: shouldExtractText = true } = options;
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    // Primero, obtener coordenadas de todos los campos usando pdf.js
    // pdf.js tiene mejor acceso a las anotaciones Widget que pdf-lib
    const pdfBytesArrayForPdfJs = pdfBytes.slice ? pdfBytes.slice(0) : new Uint8Array(pdfBytes);
    const { coordinatesMap: pdfJsCoordinates, allWidgets } = await getFieldCoordinatesWithPdfJs(pdfBytesArrayForPdfJs);
    
    // Detectar widgets adicionales que pdf-lib no ve como campos separados
    // Esto pasa con campos como IBAN donde hay múltiples casillas para el mismo campo
    // pdf-lib devuelve 1 campo, pero pdfjs ve N widgets
    const pdfLibFieldNames = new Set(fields.map(f => f.getName()));
    
    // Agrupar widgets por nombre para detectar duplicados
    const widgetsByName = new Map();
    allWidgets.forEach(w => {
      const name = w.fieldName;
      if (!widgetsByName.has(name)) {
        widgetsByName.set(name, []);
      }
      widgetsByName.get(name).push(w);
    });
    
    // Encontrar widgets adicionales: 
    // 1. Widgets huérfanos (no en pdf-lib)
    // 2. Widgets duplicados (mismo nombre, diferente posición)
    const orphanWidgets = [];
    widgetsByName.forEach((widgets, fieldName) => {
      if (!pdfLibFieldNames.has(fieldName)) {
        // Todos los widgets de este nombre son huérfanos
        orphanWidgets.push(...widgets);
      } else if (widgets.length > 1) {
        // pdf-lib tiene el campo, pero hay múltiples widgets
        // Agregar los widgets adicionales (después del primero)
        // El primero ya está cubierto por pdf-lib
        orphanWidgets.push(...widgets.slice(1));
      }
    });
    
    if (orphanWidgets.length > 0) {
      console.log(`📦 Detectados ${orphanWidgets.length} widgets adicionales (múltiples casillas como IBAN)`);
    }

    // Extraer información de campos y texto cercano en paralelo
    const fieldInfoPromises = fields.map(async (field) => {
      const fieldName = field.getName();
      const fieldType = field.constructor.name;

      // Inicializar todas las variables con valores por defecto
      let type = "text";
      let value = "";
      let options = null;
      let required = false;
      let tooltip = "";
      let alternateName = "";
      let nearbyText = "";
      let nearbyTextPosition = null; // Coordenadas del texto cercano (label)
      let label = fieldName; // Usar el nombre como fallback por defecto
      let position = null;

      try {
        // Intentar obtener tooltip (/TU) y alternate name (/TM) del campo
        // Estos son metadatos que pueden contener labels descriptivos
        try {
          const acroField = field.acroField;
          if (acroField && acroField.dict) {
            // Obtener tooltip (/TU)
            const tuValue = acroField.dict.get(PDFName.of("TU"));
            if (tuValue) {
              try {
                tooltip = tuValue.decodeText ? tuValue.decodeText() : String(tuValue);
              } catch (e) {
                tooltip = String(tuValue);
              }
            }

            // Obtener alternate name (/TM)
            const tmValue = acroField.dict.get(PDFName.of("TM"));
            if (tmValue) {
              try {
                alternateName = tmValue.decodeText ? tmValue.decodeText() : String(tmValue);
              } catch (e) {
                alternateName = String(tmValue);
              }
            }
          }
        } catch (e) {
          // Si no se pueden obtener, continuar sin ellos
          console.log(`No se pudieron obtener metadatos para campo ${fieldName}:`, e.message);
        }

        // Obtener coordenadas del campo
        // Estrategia 1: Usar coordenadas de pdf.js (más confiable)
        // Estrategia 2: Fallback a pdf-lib si pdf.js no tiene el campo
        let rectAndPage = null;
        // NO redeclarar 'position' aquí - ya existe en el scope externo (línea 488)
        
        // Primero intentar con pdf.js
        const pdfJsCoords = pdfJsCoordinates.get(fieldName);
        
        if (pdfJsCoords) {
          position = {
            page: pdfJsCoords.page,
            rect: pdfJsCoords.rect,
            x: pdfJsCoords.x,
            y: pdfJsCoords.y,
            width: pdfJsCoords.width,
            height: pdfJsCoords.height,
          };
          // Crear rectAndPage para uso posterior (extractNearbyText)
          rectAndPage = {
            pageIndex: pdfJsCoords.page - 1, // 0-indexed
            rect: pdfJsCoords.rect,
          };
        } else {
          // Fallback: intentar con pdf-lib
          try {
            rectAndPage = getFieldRectAndPage(field, pdfDoc);
            if (rectAndPage) {
              position = {
                page: rectAndPage.pageIndex + 1, // Página (1-indexed para mostrar)
                rect: rectAndPage.rect, // [llx, lly, urx, ury]
                x: Math.round(rectAndPage.rect[0]), // x izquierda
                y: Math.round(rectAndPage.rect[1]), // y inferior
                width: Math.round(rectAndPage.rect[2] - rectAndPage.rect[0]), // ancho
                height: Math.round(rectAndPage.rect[3] - rectAndPage.rect[1]), // alto
              };
            }
          } catch (positionError) {
            // Si falla obtener coordenadas, continuar sin ellas (no es crítico)
          }
        }

        // Intentar extraer texto cercano si no hay tooltip ni alternateName
        if (shouldExtractText && !tooltip && !alternateName && rectAndPage) {
          try {
            const nearbyTextResult = await extractNearbyText(
              pdfBytes,
              rectAndPage.pageIndex,
              rectAndPage.rect
            );
            if (nearbyTextResult && nearbyTextResult.text) {
              nearbyText = nearbyTextResult.text;
              if (nearbyTextResult.position) {
                nearbyTextPosition = {
                  page: rectAndPage.pageIndex + 1,
                  x: nearbyTextResult.position.x,
                  y: nearbyTextResult.position.y,
                };
              }
            }
          } catch (textError) {
            // Si falla extraer texto cercano, continuar sin él
          }
        }

        // Determinar el label a usar: tooltip > alternateName > nearbyText > fieldName
        if (tooltip) {
          label = tooltip;
        } else if (alternateName) {
          label = alternateName;
        } else if (nearbyText) {
          label = nearbyText;
        } else {
          label = fieldName;
        }

        // Determinar tipo y valor según el tipo de campo
        // Manejar PDFTextField y PDFTextField2
        if (fieldType === "PDFTextField" || fieldType === "PDFTextField2") {
          type = "text";
          value = field.getText() || "";
        } 
        // Manejar PDFCheckBox y PDFCheckBox2
        else if (fieldType === "PDFCheckBox" || fieldType === "PDFCheckBox2") {
          type = "checkbox";
          value = field.isChecked();
        } 
        // Manejar PDFDropdown y PDFDropdown2
        else if (fieldType === "PDFDropdown" || fieldType === "PDFDropdown2") {
          type = "select";
          const dropdown = field;
          options = dropdown.getOptions();
          value = dropdown.getSelected()?.[0] || "";
        } 
        // Manejar PDFRadioGroup y PDFRadioGroup2
        else if (fieldType === "PDFRadioGroup" || fieldType === "PDFRadioGroup2") {
          type = "radio";
          const radioGroup = field;
          options = radioGroup.getOptions();
          value = radioGroup.getSelected() || "";
        }

        // Intentar obtener si es requerido (no siempre está disponible)
        try {
          required = field.isRequired();
        } catch (e) {
          // Si no se puede determinar, asumir que no es requerido
          required = false;
        }
      } catch (e) {
        console.error(`Error al leer campo ${fieldName}:`, e);
        // Si hay un error crítico, devolver al menos la información básica
        return {
          name: fieldName,
          label: fieldName,
          tooltip: "",
          alternateName: "",
          nearbyText: undefined,
          position: null,
          type: "text",
          value: "",
          options: null,
          required: false,
        };
      }

      return {
        name: fieldName,
        label: label, // Label descriptivo (tooltip > alternateName > nearbyText > name)
        tooltip: tooltip, // Tooltip original si existe
        alternateName: alternateName, // Nombre alternativo si existe
        nearbyText: nearbyText || undefined, // Texto cercano extraído si existe
        nearbyTextPosition: nearbyTextPosition, // Coordenadas del texto cercano (label) { page, x, y }
        position: position, // Coordenadas del campo { page, rect, x, y, width, height }
        type,
        value,
        options,
        required,
      };
    });

    // Esperar a que todas las promesas se resuelvan
    const fieldInfo = await Promise.all(fieldInfoPromises);
    
    // Filtrar campos nulos o inválidos (por si acaso)
    const validFields = fieldInfo.filter(f => f && f.name);
    
    // Ordenar campos por posición visual: página, luego de arriba a abajo, luego de izquierda a derecha
    // En PDF, Y crece hacia arriba, así que Y más alto = más arriba en la página
    validFields.sort((a, b) => {
      // Si alguno no tiene posición, ponerlo al final
      if (!a.position && !b.position) return 0;
      if (!a.position) return 1;
      if (!b.position) return -1;
      
      // Primero ordenar por página
      const pageDiff = a.position.page - b.position.page;
      if (pageDiff !== 0) return pageDiff;
      
      // Luego por Y (descendente - de arriba a abajo, Y mayor = más arriba)
      const yDiff = b.position.y - a.position.y;
      if (Math.abs(yDiff) > 10) return yDiff; // Tolerancia de 10 puntos para considerar misma línea
      
      // Si están en la misma línea, ordenar por X (izquierda a derecha)
      return a.position.x - b.position.x;
    });
    
    // Agregar widgets adicionales que pdf-lib no detectó como campos separados
    // Esto incluye widgets adicionales de campos como IBAN con múltiples casillas
    if (orphanWidgets.length > 0) {
      console.log(`📦 Añadiendo ${orphanWidgets.length} widgets adicionales...`);
      
      // Contar cuántos widgets ya existen por nombre (incluyendo los de pdf-lib)
      const existingNameCount = {};
      validFields.forEach(f => {
        const baseName = f.name.replace(/_\d+$/, ''); // Quitar sufijo numérico si existe
        existingNameCount[baseName] = (existingNameCount[baseName] || 0) + 1;
      });
      
      orphanWidgets.forEach(widget => {
        const baseName = widget.fieldName || 'widget';
        existingNameCount[baseName] = (existingNameCount[baseName] || 0) + 1;
        
        // Generar nombre único con índice
        const uniqueName = `${baseName}_${existingNameCount[baseName]}`;
        
        // Determinar tipo de campo basado en fieldType de pdfjs
        let type = 'text';
        if (widget.fieldType === 'Btn') {
          // Btn puede ser checkbox, radio o pushbutton
          // Si es pequeño (< 30px), probablemente es checkbox
          type = widget.width < 30 && widget.height < 30 ? 'checkbox' : 'text';
        } else if (widget.fieldType === 'Ch') {
          type = 'select';
        }
        
        validFields.push({
          name: uniqueName,
          label: `${baseName} [${existingNameCount[baseName]}]`, // Label más descriptivo
          tooltip: '',
          alternateName: '',
          nearbyText: undefined,
          nearbyTextPosition: null,
          position: {
            page: widget.page,
            rect: widget.rect,
            x: widget.x,
            y: widget.y,
            width: widget.width,
            height: widget.height,
          },
          type,
          value: type === 'checkbox' ? false : '',
          options: null,
          required: false,
          _isOrphanWidget: true, // Marcar como widget adicional
          _parentFieldName: baseName, // Nombre del campo padre
        });
      });
    }
    
    // Re-ordenar después de agregar widgets huérfanos
    validFields.sort((a, b) => {
      if (!a.position && !b.position) return 0;
      if (!a.position) return 1;
      if (!b.position) return -1;
      
      const pageDiff = a.position.page - b.position.page;
      if (pageDiff !== 0) return pageDiff;
      
      const yDiff = b.position.y - a.position.y;
      if (Math.abs(yDiff) > 10) return yDiff;
      
      return a.position.x - b.position.x;
    });
    
    console.log(`✓ Total campos detectados: ${validFields.length} (${fields.length} de pdf-lib + ${orphanWidgets.length} widgets huérfanos)`);

    // Log de campos con labels encontrados
    const fieldsWithLabels = validFields.filter(f => f.tooltip || f.alternateName || f.nearbyText);
    if (fieldsWithLabels.length > 0) {
      console.log(`✓ Encontrados ${fieldsWithLabels.length} campos con labels`);
      const withTooltip = fieldsWithLabels.filter(f => f.tooltip).length;
      const withAltName = fieldsWithLabels.filter(f => f.alternateName).length;
      const withNearby = fieldsWithLabels.filter(f => f.nearbyText).length;
      console.log(`  - Tooltips: ${withTooltip}, AlternateNames: ${withAltName}, Texto cercano: ${withNearby}`);
      fieldsWithLabels.slice(0, 5).forEach(f => {
        const sources = [];
        if (f.tooltip) sources.push(`tooltip="${f.tooltip}"`);
        if (f.alternateName) sources.push(`altName="${f.alternateName}"`);
        if (f.nearbyText) sources.push(`nearby="${f.nearbyText}"`);
        console.log(`  - "${f.name}": label="${f.label}" (${sources.join(", ")})`);
      });
      if (fieldsWithLabels.length > 5) {
        console.log(`  ... y ${fieldsWithLabels.length - 5} más`);
      }
    } else {
      console.log("ℹ No se encontraron labels en los campos. Se usarán los nombres de campo.");
    }

    return validFields;
  } catch (error) {
    console.error("Error al leer campos del PDF:", error);
    throw error;
  }
}

/**
 * Rellena un formulario PDF con los valores proporcionados
 * @param {ArrayBuffer} pdfBytes - Bytes del PDF original
 * @param {Object} fieldValues - Objeto con los valores a rellenar { fieldName: value }
 * @param {Object} options - Opciones adicionales
 * @param {boolean} options.flatten - Si hacer flatten del formulario (default: true). Si es false, el PDF seguirá siendo interactivo pero preservará mejor los estilos de checkboxes.
 * @returns {Promise<Uint8Array>} Bytes del PDF rellenado
 */
export async function fillPdfForm(pdfBytes, fieldValues, options = {}) {
  const { flatten: shouldFlatten = true } = options;
  try {
    console.log("=== FILL PDF FORM ===");
    console.log("📄 pdfBytes tamaño:", pdfBytes?.byteLength || 0);
    
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    const pdfFieldNames = fields.map(f => f.getName());
    const valueKeys = Object.keys(fieldValues);
    
    console.log("📋 Campos en el PDF:", pdfFieldNames);
    console.log("📝 Claves en fieldValues:", valueKeys);
    
    // Verificar coincidencias
    const coincidencias = valueKeys.filter(k => pdfFieldNames.includes(k));
    const sinCoincidencia = valueKeys.filter(k => !pdfFieldNames.includes(k));
    
    console.log("✅ Campos que coinciden:", coincidencias.length, coincidencias);
    if (sinCoincidencia.length > 0) {
      console.warn("⚠️ Campos en values que NO existen en el PDF:", sinCoincidencia);
    }

    let filledCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    fields.forEach((field) => {
      const fieldName = field.getName();
      const fieldType = field.constructor.name;
      const value = fieldValues[fieldName];

      // Solo saltar si el valor no está definido (no si está vacío, porque puede ser intencional)
      if (value === undefined || value === null) {
        skippedCount++;
        return;
      }

      try {
        // Manejar PDFTextField y PDFTextField2
        if (fieldType === "PDFTextField" || fieldType === "PDFTextField2") {
          // Para campos de texto, permitir strings vacíos
          const textValue = String(value || "");
          
          // Depuración: obtener propiedades del campo para detectar campos comb
          try {
            const acroField = field.acroField;
            if (acroField && acroField.dict) {
              const maxLen = acroField.dict.get(PDFName.of("MaxLen"));
              const flags = acroField.dict.get(PDFName.of("Ff"));
              // Bit 25 (0x1000000) = Comb field
              const isComb = flags ? (flags.asNumber() & 0x1000000) !== 0 : false;
              
              if (maxLen || isComb) {
                console.log(`📋 Campo "${fieldName}" - MaxLen: ${maxLen || 'N/A'}, Comb: ${isComb}, Valor a escribir: "${textValue}" (${textValue.length} chars)`);
                
                // Si es comb y el valor excede MaxLen, truncar
                if (isComb && maxLen && textValue.length > maxLen.asNumber()) {
                  const truncated = textValue.substring(0, maxLen.asNumber());
                  console.log(`  ⚠️ Truncando valor de ${textValue.length} a ${maxLen.asNumber()} caracteres: "${truncated}"`);
                  field.setText(truncated);
                  filledCount++;
                  console.log(`✓ Rellenado campo comb "${fieldName}" con: "${truncated}"`);
                  return; // Continuar con el siguiente campo
                }
              }
            }
          } catch (debugError) {
            console.log(`  (No se pudieron obtener propiedades de "${fieldName}":`, debugError.message, ")");
          }
          
          field.setText(textValue);
          
          // Verificación inmediata: confirmar que el valor se guardó
          const savedValue = field.getText();
          if (savedValue === undefined || savedValue === null) {
            console.error(`❌ ERROR: Campo "${fieldName}" no aceptó el valor. getText() devuelve: ${savedValue}`);
            // Intentar escribir directamente en el diccionario como fallback
            try {
              const acroField = field.acroField;
              if (acroField && acroField.dict) {
                // Escribir el valor directamente usando /V (value)
                acroField.dict.set(PDFName.of("V"), pdfDoc.context.obj(textValue));
                console.log(`  🔧 Intentando escribir directamente en dict /V: "${textValue}"`);
                errorCount++;
              }
            } catch (directWriteError) {
              console.error(`  ❌ Fallback también falló:`, directWriteError.message);
              errorCount++;
            }
          } else {
            filledCount++;
            console.log(`✓ Rellenado campo texto "${fieldName}" con: "${textValue.substring(0, 30)}${textValue.length > 30 ? '...' : ''}"`);
          }
        } 
        // Manejar PDFCheckBox y PDFCheckBox2
        else if (fieldType === "PDFCheckBox" || fieldType === "PDFCheckBox2") {
          const shouldBeChecked = value === true || value === "true" || value === "on" || value === true;
          console.log(`Procesando checkbox "${fieldName}": valor=${value}, tipo=${typeof value}, debería estar marcado=${shouldBeChecked}`);
          
          try {
            // Obtener el estado actual antes de cambiar
            const wasChecked = field.isChecked();
            console.log(`  Estado inicial del checkbox "${fieldName}": ${wasChecked ? "marcado" : "desmarcado"}`);
            
            if (shouldBeChecked) {
              // Intentar obtener el valor de exportación del checkbox
              // Algunos checkboxes requieren un valor específico para que se muestre
              try {
                const exportValues = field.getExportValues();
                console.log(`  Valores de exportación disponibles:`, exportValues);
                if (exportValues && exportValues.length > 0) {
                  // Si tiene valores de exportación, usar el primero
                  field.select(exportValues[0]);
                  console.log(`  Usando valor de exportación: ${exportValues[0]}`);
                } else {
                  // Si no tiene valores de exportación, usar check() normal
                  field.check();
                  console.log(`  Usando check() estándar`);
                }
              } catch (e) {
                // Si getExportValues falla, intentar check() normal
                console.log(`  getExportValues falló, usando check():`, e.message);
                field.check();
              }
              // NO llamamos updateAppearances() para preservar el estilo original
              filledCount++;
              console.log(`✓ Marcado checkbox "${fieldName}"`);
            } else {
              field.uncheck();
              // NO llamamos updateAppearances() para preservar el estilo original
              filledCount++;
              console.log(`✓ Desmarcado checkbox "${fieldName}"`);
            }
            
            // Verificar que se aplicó correctamente
            const isChecked = field.isChecked();
            console.log(`  Estado final del checkbox "${fieldName}": ${isChecked ? "marcado" : "desmarcado"}`);
            
            if (shouldBeChecked !== isChecked) {
              console.warn(`⚠ ADVERTENCIA: Checkbox "${fieldName}" no se aplicó correctamente. Esperado: ${shouldBeChecked}, Obtenido: ${isChecked}`);
            }
          } catch (e) {
            errorCount++;
            console.error(`✗ Error al procesar checkbox "${fieldName}":`, e);
          }
        } 
        // Manejar PDFDropdown y PDFDropdown2
        else if (fieldType === "PDFDropdown" || fieldType === "PDFDropdown2") {
          if (value) {
            field.select(String(value));
            filledCount++;
            console.log(`✓ Seleccionado dropdown "${fieldName}" con: "${value}"`);
          } else {
            skippedCount++;
          }
        } 
        // Manejar PDFRadioGroup y PDFRadioGroup2
        else if (fieldType === "PDFRadioGroup" || fieldType === "PDFRadioGroup2") {
          if (value) {
            field.select(String(value));
            filledCount++;
            console.log(`✓ Seleccionado radio "${fieldName}" con: "${value}"`);
          } else {
            skippedCount++;
          }
        } else {
          console.warn(`Tipo de campo desconocido "${fieldType}" para campo "${fieldName}"`);
          skippedCount++;
        }
      } catch (e) {
        errorCount++;
        console.error(`✗ Error al rellenar campo "${fieldName}" (tipo: ${fieldType}):`, e);
      }
    });

    console.log(`Resumen: ${filledCount} campos rellenados, ${skippedCount} saltados, ${errorCount} errores`);

    // Verificar que los valores se aplicaron correctamente
    console.log("Verificando valores aplicados...");
    fields.forEach((field) => {
      const fieldName = field.getName();
      const fieldType = field.constructor.name;
      try {
        if (fieldType === "PDFTextField" || fieldType === "PDFTextField2") {
          const currentValue = field.getText();
          const expectedValue = fieldValues[fieldName];
          if (expectedValue !== undefined && currentValue !== String(expectedValue || "")) {
            console.warn(`⚠ Campo "${fieldName}": esperado "${expectedValue}", pero tiene "${currentValue}"`);
          } else if (expectedValue !== undefined) {
            console.log(`✓ Verificado campo "${fieldName}": "${currentValue.substring(0, 30)}${currentValue.length > 30 ? '...' : ''}"`);
          }
        }
      } catch (e) {
        // Ignorar errores al verificar
      }
    });

    // OPCIÓN 1: No llamamos updateAppearances() para preservar estilos originales de checkboxes
    // OPCIÓN 2: Seteamos NeedAppearances flag para que el visor PDF regenere las apariencias
    // Esto le dice al visor PDF que debe recalcular las apariencias basándose en los valores
    try {
      const acroForm = pdfDoc.catalog.lookup(PDFName.of("AcroForm"));
      if (acroForm && acroForm.dict) {
        acroForm.dict.set(PDFName.of("NeedAppearances"), PDFBool.True);
        console.log("✓ Flag NeedAppearances seteado - el visor regenerará las apariencias");
      }
    } catch (e) {
      console.log("No se pudo setear NeedAppearances (puede que no sea necesario):", e.message);
    }
    
    // Verificar estado final de checkboxes
    console.log("Verificando estado final de checkboxes...");
    fields.forEach((field) => {
      const fieldType = field.constructor.name;
      if (fieldType === "PDFCheckBox" || fieldType === "PDFCheckBox2") {
        try {
          const fieldName = field.getName();
          const isChecked = field.isChecked();
          const expectedValue = fieldValues[fieldName];
          const shouldBeChecked = expectedValue === true || expectedValue === "true" || expectedValue === "on";
          
          if (expectedValue !== undefined && shouldBeChecked !== isChecked) {
            console.warn(`⚠ Checkbox "${fieldName}" no coincide. Esperado: ${shouldBeChecked}, Obtenido: ${isChecked}`);
          } else if (expectedValue !== undefined) {
            console.log(`✓ Checkbox "${fieldName}" correcto: ${isChecked ? "marcado" : "desmarcado"}`);
          }
        } catch (e) {
          // Ignorar errores
        }
      }
    });

    // Aplanar (flatten) el formulario) solo si se solicita
    // NOTA: flatten() puede causar que los checkboxes pierdan su estilo visual (el cuadro)
    // Si shouldFlatten es false, el PDF seguirá siendo interactivo pero preservará mejor los estilos
    if (shouldFlatten) {
      try {
        // Algunas versiones de pdf-lib permiten pasar opciones a flatten()
        // Intentar con updateFieldAppearances si está disponible
        if (typeof form.flatten === 'function') {
          try {
            // Intentar con opciones primero (puede que no esté disponible en todas las versiones)
            form.flatten({ updateFieldAppearances: true });
            console.log("Formulario aplanado (flattened) con updateFieldAppearances exitosamente");
          } catch (e) {
            // Si falla con opciones, intentar sin opciones
            console.log("Intentando flatten sin opciones...");
            form.flatten();
            console.log("Formulario aplanado (flattened) exitosamente");
          }
        }
      } catch (e) {
        console.warn("No se pudo aplanar el formulario (puede que no sea necesario):", e);
      }
    } else {
      console.log("Flatten omitido - el PDF seguirá siendo interactivo para preservar estilos de checkboxes");
    }

    // Generar el PDF rellenado
    const pdfBytesFilled = await pdfDoc.save();
    console.log("PDF rellenado generado exitosamente, tamaño:", pdfBytesFilled.length, "bytes");
    return pdfBytesFilled;
  } catch (error) {
    console.error("Error al rellenar PDF:", error);
    throw error;
  }
}

/**
 * Extrae el texto de un PDF organizado por páginas
 * Útil para mostrar el contenido del PDF como referencia mientras se rellenan campos
 * Inserta marcadores [_____] después de patrones que indican campos de formulario (texto seguido de :)
 * @param {ArrayBuffer} pdfBytes - Bytes del PDF
 * @param {Array} formFields - Campos de formulario (opcional, para referencia)
 * @returns {Promise<Array<{page: number, text: string}>>} Array con el texto de cada página
 */
export async function extractPdfTextByPage(pdfBytes, formFields = []) {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    const pages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Reconstruir el texto preservando saltos de línea aproximados
      const items = textContent.items;
      if (items.length === 0) {
        pages.push({ page: i, text: "" });
        continue;
      }

      // Ordenar por posición Y (descendente) y luego por X (ascendente)
      const sortedItems = [...items].sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5]; // Y descendente (arriba primero)
        if (Math.abs(yDiff) > 5) return yDiff;
        return a.transform[4] - b.transform[4]; // X ascendente (izquierda primero)
      });

      // Agrupar por líneas (items con Y similar), guardando la coordenada Y
      const linesWithY = [];
      let currentLine = [];
      let lastY = sortedItems[0]?.transform[5];
      let lineY = lastY;

      for (const item of sortedItems) {
        const y = item.transform[5];
        // Si la diferencia de Y es mayor a 10, es una nueva línea
        if (Math.abs(y - lastY) > 10) {
          if (currentLine.length > 0) {
            linesWithY.push({ 
              text: currentLine.map(i => i.str).join(" "),
              y: lineY
            });
          }
          currentLine = [item];
          lastY = y;
          lineY = y;
        } else {
          currentLine.push(item);
        }
      }
      // Agregar la última línea
      if (currentLine.length > 0) {
        linesWithY.push({ 
          text: currentLine.map(i => i.str).join(" "),
          y: lineY
        });
      }

      // Separar campos de texto y checkboxes de esta página
      // Ordenar de arriba a abajo, y en la misma línea de izquierda a derecha
      const sortByPosition = (a, b) => {
        const yDiff = b.position.y - a.position.y; // Y mayor = más arriba
        if (Math.abs(yDiff) > 10) return yDiff; // Tolerancia de 10 pts para misma línea
        return a.position.x - b.position.x; // X menor = más a la izquierda
      };
      
      const pageTextFields = formFields
        .filter(f => f.position?.page === i && f.type !== "checkbox")
        .sort(sortByPosition);
      
      const pageCheckboxes = formFields
        .filter(f => f.position?.page === i && f.type === "checkbox")
        .sort(sortByPosition);
      
      // Crear copias para consumir mientras procesamos
      const remainingTextFields = [...pageTextFields];
      
      // Debug: mostrar texto crudo de la página (primeras 3 páginas)
      if (i <= 2) {
        const rawText = linesWithY.map(l => l.text).join("\n");
        console.log(`\n📄 PÁGINA ${i} - TEXTO CRUDO:\n${rawText.substring(0, 1500)}...`);
      }
      
      // Set para rastrear campos ya insertados (evitar duplicados)
      const usedFields = new Set();
      
      // Procesar cada línea e insertar marcadores para TODOS los campos
      const processedLines = linesWithY.map(({ text: line, y: lineY }) => {
        // Obtener campos en esta línea que NO se hayan usado ya
        const checkboxesInLine = pageCheckboxes.filter(f => {
          if (!f.position || usedFields.has(f.name)) return false;
          return Math.abs(f.position.y - lineY) < 15;
        }).sort((a, b) => a.position.x - b.position.x);
        
        const textFieldsInLine = pageTextFields.filter(f => {
          if (!f.position || usedFields.has(f.name)) return false;
          return Math.abs(f.position.y - lineY) < 15;
        }).sort((a, b) => a.position.x - b.position.x);
        
        // Marcar como usados
        checkboxesInLine.forEach(f => usedFields.add(f.name));
        textFieldsInLine.forEach(f => usedFields.add(f.name));
        
        let processedLine = line;
        
        // 1. Reemplazar caracteres especiales (cuadrados, etc) con checkboxes
        let cbIndex = 0;
        processedLine = processedLine.replace(/([\uF063□■☐☑☒▢▣◻◼⬜⬛])/g, (match) => {
          if (cbIndex < checkboxesInLine.length) {
            const cb = checkboxesInLine[cbIndex++];
            return `[${cb.name}]`;
          }
          return match;
        });
        
        // 2. Tratamiento especial para IBAN: tomar campos de la página en orden
        let tfIndex = 0;
        const isIbanLine = processedLine.includes('IBAN:') || processedLine.includes('IBAN :');
        
        if (isIbanLine) {
          // Contar cuántos grupos de U+F07C hay en la línea
          const ibanGroups = processedLine.match(/\uF07C+/g) || [];
          const numIbanFields = ibanGroups.length;
          
          // Tomar los próximos N campos de texto de la página que no se hayan usado
          // (ordenados por Y descendente, luego X ascendente - el orden natural)
          const availableFields = pageTextFields.filter(f => !usedFields.has(f.name));
          const ibanFields = availableFields.slice(0, numIbanFields);
          
          // Marcar estos campos como usados
          ibanFields.forEach(f => usedFields.add(f.name));
          
          // Reemplazar cada grupo de U+F07C con su campo correspondiente
          let ibanIndex = 0;
          processedLine = processedLine.replace(/\uF07C+/g, () => {
            if (ibanIndex < ibanFields.length) {
              return `(_${ibanFields[ibanIndex++].name}_)`;
            }
            return '(_?_)';
          });
          
          tfIndex = numIbanFields;
        }
        
        // 3. Reemplazar otros grupos de U+F07C (campos de texto visibles)
        processedLine = processedLine.replace(/\uF07C+/g, (match) => {
          if (tfIndex < textFieldsInLine.length) {
            const tf = textFieldsInLine[tfIndex++];
            return `(_${tf.name}_)`;
          }
          return match;
        });
        
        // 4. Detectar patrones "label:" para campos sin caracteres visibles
        processedLine = processedLine.replace(/([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ\s\(\)\/\.]*):(\s*)(?!\()/g, (match, label, spaces) => {
          if (label.trim().length < 2) return match;
          
          if (tfIndex < textFieldsInLine.length) {
            const tf = textFieldsInLine[tfIndex++];
            return `${label}: (_${tf.name}_) `;
          }
          return match;
        });
        
        // 3. Si quedan campos sin asignar, agregarlos al final
        const remainingCheckboxes = checkboxesInLine.slice(cbIndex);
        const remainingTextFields = textFieldsInLine.slice(tfIndex);
        
        if (remainingCheckboxes.length > 0 || remainingTextFields.length > 0) {
          const remaining = [
            ...remainingCheckboxes.map(f => `[${f.name}]`),
            ...remainingTextFields.map(f => `(_${f.name}_)`)
          ].join(" ");
          processedLine += `  ← ${remaining}`;
        }
        
        return processedLine;
      });

      const text = processedLines.join("\n").trim();
      pages.push({ page: i, text, fieldCount: pageTextFields.length + pageCheckboxes.length });
    }

    const totalFields = formFields.length;
    console.log(`✓ Texto extraído de ${pages.length} páginas con ${totalFields} campos detectados`);
    return pages;
  } catch (error) {
    console.error("Error al extraer texto del PDF:", error);
    return [];
  }
}

/**
 * Descarga un PDF como archivo
 * @param {Uint8Array} pdfBytes - Bytes del PDF
 * @param {string} filename - Nombre del archivo
 */
export function downloadPdf(pdfBytes, filename) {
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Convierte un PDF a imágenes base64 (una por página)
 * Usa pdfjs-dist para renderizar cada página en un canvas
 * @param {ArrayBuffer} pdfBytes - Bytes del PDF
 * @param {Object} options - Opciones de conversión
 * @param {number} options.maxPages - Máximo de páginas a convertir (default: 4)
 * @param {number} options.scale - Escala de renderizado (default: 1.5 para buena calidad)
 * @param {string} options.format - Formato de imagen: 'png' o 'jpeg' (default: 'png')
 * @param {number} options.quality - Calidad para JPEG (0-1, default: 0.85)
 * @returns {Promise<Array<{page: number, base64: string, width: number, height: number}>>}
 */
export async function convertPdfToImages(pdfBytes, options = {}) {
  const {
    maxPages = 4,
    scale = 1.5,
    format = "png",
    quality = 0.85,
  } = options;

  try {
    console.log("📸 Convirtiendo PDF a imágenes...");
    
    // Cargar el PDF con pdfjs
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    
    const numPages = Math.min(pdf.numPages, maxPages);
    console.log(`📄 PDF tiene ${pdf.numPages} páginas, convirtiendo ${numPages}`);
    
    const images = [];
    
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      
      // Crear canvas para renderizar la página
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Renderizar la página en el canvas
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
      
      // Convertir canvas a base64
      const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
      const base64 = canvas.toDataURL(mimeType, format === "jpeg" ? quality : undefined);
      
      images.push({
        page: pageNum,
        base64,
        width: canvas.width,
        height: canvas.height,
      });
      
      console.log(`  ✓ Página ${pageNum}/${numPages} convertida (${canvas.width}x${canvas.height})`);
    }
    
    console.log(`✓ ${images.length} páginas convertidas a imágenes`);
    return images;
  } catch (error) {
    console.error("Error al convertir PDF a imágenes:", error);
    throw new Error(`Error al convertir PDF: ${error.message}`);
  }
}

/**
 * Detecta campos de formulario AcroForm usando OpenAI GPT-4o Vision
 * Envía las páginas del PDF como imágenes a una Supabase Edge Function
 * @param {ArrayBuffer} pdfBytes - Bytes del PDF
 * @param {Object} options - Opciones
 * @param {string} options.supabaseUrl - URL de Supabase (opcional, usa env var si no se provee)
 * @param {string} options.supabaseKey - Anon key de Supabase (opcional, usa env var si no se provee)
 * @param {number} options.maxPages - Máximo de páginas a analizar (default: 4)
 * @returns {Promise<Array>} Array de campos detectados en formato compatible con getPdfFields
 */
export async function getPdfFieldsWithOpenAI(pdfBytes, options = {}) {
  const {
    supabaseUrl = import.meta.env.VITE_SUPABASE_URL,
    // Intentar con ANON_KEY primero (formato estándar JWT), fallback a PUBLISHABLE_DEFAULT_KEY
    supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    maxPages = 6, // Hasta 6 páginas (límite de la Edge Function)
    timeoutMs = 120000, // 2 minutos de timeout
  } = options;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Se requieren las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (o VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY)");
  }
  
  // Debug: verificar formato de la clave
  console.log("🔑 Supabase URL:", supabaseUrl);
  console.log("🔑 Clave (primeros 20 chars):", supabaseKey?.substring(0, 20) + "...");

  console.log("🤖 Detectando campos con OpenAI GPT-4o Vision...");

  try {
    // 1. Convertir PDF a imágenes
    const images = await convertPdfToImages(pdfBytes, { maxPages });
    
    if (images.length === 0) {
      throw new Error("No se pudieron generar imágenes del PDF");
    }

    // 2. Extraer solo los base64 de las imágenes (sin el prefijo data:image/...)
    const imageBase64s = images.map(img => img.base64);

    // 3. Llamar a la Supabase Edge Function con timeout
    const functionUrl = `${supabaseUrl}/functions/v1/detect-acroforms`;
    console.log(`📡 Llamando a Edge Function: ${functionUrl}`);
    console.log(`⏱️ Timeout configurado: ${timeoutMs / 1000}s, Páginas: ${images.length}`);

    // Crear AbortController para timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
          "apikey": supabaseKey,
        },
        body: JSON.stringify({ images: imageBase64s }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === "AbortError") {
        throw new Error(`Timeout: La función tardó más de ${timeoutMs / 1000} segundos. Intenta con menos páginas.`);
      }
      throw new Error(`Error de conexión: ${fetchError.message}. Verifica que la Edge Function esté desplegada.`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let errorMessage = `Error ${response.status}: ${response.statusText}`;
      
      if (response.status === 504) {
        errorMessage = "Gateway Timeout (504): La función tardó demasiado. Intenta con menos páginas o verifica que OPENAI_API_KEY esté configurada.";
      } else if (response.status === 401) {
        errorMessage = "No autorizado (401): Verifica VITE_SUPABASE_ANON_KEY en .env.local";
      } else if (errorText) {
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = errorText.substring(0, 200);
        }
      }
      
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log(`✓ OpenAI describió ${result.totalFields || 0} campos en ${result.totalPages} páginas`);
    
    // Log resumen por página
    if (result.pages) {
      console.log("📊 Resumen por página:");
      result.pages.forEach(page => {
        console.log(`  Página ${page.page}: ${page.fields.length} campos - ${page.summary?.substring(0, 60)}...`);
      });
    }

    // Devolver el resultado directamente (formato simplificado)
    // { pages: [{ page, summary, fields: string[] }], totalPages, totalFields }
    return result;
  } catch (error) {
    console.error("Error al detectar campos con OpenAI:", error);
    throw new Error(`Error con OpenAI: ${error.message}`);
  }
}
