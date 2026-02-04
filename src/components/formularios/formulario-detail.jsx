import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useEntities } from "@/hooks/use-entities";
import { getPdfFields, getPdfFieldsWithOpenAI, fillPdfForm, downloadPdf, extractPdfTextByPage } from "@/lib/pdf-utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, AlertCircle, Save, Upload, Trash2, FileText, Download, ChevronDown, ChevronRight, Edit, Copy, RefreshCw, Sparkles } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useVerticalViewport } from "@/hooks/use-vertical-viewport";
import { cn } from "@/lib/utils";

export function FormularioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isMobile } = useVerticalViewport();
  const [formulario, setFormulario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [newPdfFile, setNewPdfFile] = useState(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [confirmDeletePdf, setConfirmDeletePdf] = useState(false);
  const [pdfBytes, setPdfBytes] = useState(null);
  const [formFields, setFormFields] = useState([]);
  const [fieldValues, setFieldValues] = useState({});
  const [loadingFields, setLoadingFields] = useState(false);
  const [fillingPdf, setFillingPdf] = useState(false);
  const [loadingOpenAI, setLoadingOpenAI] = useState(false); // Estado de carga para detección con OpenAI
  const [pdfTextByPage, setPdfTextByPage] = useState([]); // Texto del PDF por página (referencia)
  const [expandedPages, setExpandedPages] = useState({}); // Páginas expandidas en el acordeón
  const [showPdfText, setShowPdfText] = useState(true); // Mostrar/ocultar sección de texto del PDF
  const [descripcion, setDescripcion] = useState(null); // JSON de OpenAI con descripción del formulario
  const [generatedData, setGeneratedData] = useState(null); // Datos fake generados por IA
  const [generatingData, setGeneratingData] = useState(false); // Estado de carga para generación de datos

  const formulariosApi = useEntities("formulario");

  useEffect(() => {
    loadFormulario();
  }, [id]);

  useEffect(() => {
    if (formulario?.pdf_path) {
      const { data } = supabase.storage
        .from("formularios")
        .getPublicUrl(formulario.pdf_path);
      setPdfUrl(data.publicUrl);
    } else {
      setPdfUrl(null);
      setPdfBytes(null);
      setFormFields([]);
      setFieldValues({});
    }
  }, [formulario?.pdf_path]);

  // Función para cargar PDF y detectar campos (reutilizable)
  const loadPdfAndDetectFields = useCallback(async () => {
    console.log("📥 loadPdfAndDetectFields llamado");
    
    if (!pdfUrl) {
      console.log("⚠️ No hay pdfUrl, limpiando campos");
      setPdfBytes(null);
      setFormFields([]);
      setFieldValues({});
      setPdfTextByPage([]);
      setExpandedPages({});
      return;
    }

    try {
      setLoadingFields(true);
      console.log("⏳ Iniciando carga de campos...");
      
      // Descargar PDF
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error("Error al descargar el PDF");
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // IMPORTANTE: pdf.js puede "detachar" el ArrayBuffer al transferirlo al worker
      // Por eso hacemos copias ANTES de usar cualquier función que use pdf.js
      const arrayBufferForFields = arrayBuffer.slice(0); // Copia para getPdfFields (usa pdf.js internamente)
      const arrayBufferForText = arrayBuffer.slice(0);   // Copia para extractPdfTextByPage
      const arrayBufferForFilling = arrayBuffer.slice(0); // Copia limpia para rellenar el PDF
      
      setPdfBytes(arrayBufferForFilling);

      // Detectar campos del formulario usando pdf-lib (local, sin costos)
      console.log("📚 Usando pdf-lib para detectar campos (local)");
      const fields = await getPdfFields(arrayBufferForFields);
      setFormFields(fields);

      // Extraer texto del PDF por páginas (para referencia)
      // Pasamos los campos para insertar marcadores donde hay campos de texto
      try {
        console.log("📄 Extrayendo texto del PDF con marcadores de campos...");
        const textPages = await extractPdfTextByPage(arrayBufferForText, fields);
        console.log("📄 Texto extraído:", textPages.length, "páginas");
        if (textPages.length > 0) {
          console.log("📄 Primera página preview:", textPages[0].text.substring(0, 200));
        }
        setPdfTextByPage(textPages);
        // Por defecto expandir la primera página
        if (textPages.length > 0) {
          setExpandedPages({ 1: true });
        }
      } catch (textError) {
        console.error("❌ No se pudo extraer texto del PDF:", textError);
        setPdfTextByPage([]);
      }
      
      // Inicializar valores de campos con valores por defecto
      const initialValues = {};
      fields.forEach((field) => {
        if (field.type === "checkbox") {
          initialValues[field.name] = field.value || false;
        } else {
          initialValues[field.name] = field.value || "";
        }
      });
      setFieldValues(initialValues);
      console.log("Campos detectados:", fields);
      console.log("Valores iniciales:", initialValues);
    } catch (error) {
      console.error("Error al cargar PDF o detectar campos:", error);
      // Si no es un AcroForm o hay error, simplemente no mostrar campos
      setFormFields([]);
      setFieldValues({});
    } finally {
      setLoadingFields(false);
    }
  }, [pdfUrl]);

  // Descargar PDF y detectar campos cuando pdfUrl cambia
  useEffect(() => {
    console.log("🔄 useEffect ejecutado - loadPdfAndDetectFields");
    loadPdfAndDetectFields();
  }, [loadPdfAndDetectFields]);

  async function loadFormulario() {
    try {
      setLoading(true);
      setError(null);

      const { data } = await formulariosApi.get(id);

      if (!data) {
        throw new Error("Formulario no encontrado");
      }

      setFormulario(data);
      setNombre(data.nombre || "");
      // Cargar descripción de OpenAI si existe
      if (data.descripcion) {
        try {
          setDescripcion(JSON.parse(data.descripcion));
        } catch (e) {
          console.error("Error al parsear descripcion:", e);
          setDescripcion(null);
        }
      } else {
        setDescripcion(null);
      }
    } catch (err) {
      console.error("Error al cargar formulario:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveNombre() {
    if (!nombre.trim() || nombre === formulario?.nombre) return;

    try {
      setSaving(true);

      await formulariosApi.update(id, { nombre: nombre.trim() });

      setFormulario({ ...formulario, nombre: nombre.trim() });
    } catch (err) {
      console.error("Error al guardar nombre:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setNewPdfFile(file);
    } else if (file) {
      alert("Por favor selecciona un archivo PDF");
      e.target.value = "";
    }
  };

  async function uploadPdf() {
    if (!newPdfFile) return;

    try {
      setUploadingPdf(true);

      // Eliminar PDF anterior si existe
      if (formulario?.pdf_path) {
        await supabase.storage
          .from("formularios")
          .remove([formulario.pdf_path]);
      }

      // Subir nuevo PDF
      const fileExt = newPdfFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("formularios")
        .upload(fileName, newPdfFile);

      if (uploadError) {
        throw new Error(`Error al subir PDF: ${uploadError.message}`);
      }

      // Actualizar registro en la base de datos
      await formulariosApi.update(id, { pdf_path: fileName });

      const updatedFormulario = { ...formulario, pdf_path: fileName };
      setFormulario(updatedFormulario);
      setNewPdfFile(null);
      
      // Reset file input
      const fileInput = document.getElementById("pdf-upload");
      if (fileInput) fileInput.value = "";
      
      // Actualizar URL para que se detecten los campos del nuevo PDF
      const { data } = supabase.storage
        .from("formularios")
        .getPublicUrl(fileName);
      setPdfUrl(data.publicUrl);
    } catch (err) {
      console.error("Error al subir PDF:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setUploadingPdf(false);
    }
  }

  async function deletePdf() {
    if (!formulario?.pdf_path) return;

    try {
      setConfirmDeletePdf(false);

      // Eliminar del storage
      await supabase.storage
        .from("formularios")
        .remove([formulario.pdf_path]);

      // Actualizar registro
      await formulariosApi.update(id, { pdf_path: null });

      setFormulario({ ...formulario, pdf_path: null });
      setPdfUrl(null);
      setPdfBytes(null);
      setFormFields([]);
      setFieldValues({});
    } catch (err) {
      console.error("Error al eliminar PDF:", err);
      alert(`Error: ${err.message}`);
    }
  }

  async function handleGenerateFilledPdf() {
    if (!pdfBytes || formFields.length === 0) return;

    try {
      setFillingPdf(true);

      console.log("=== GENERANDO PDF RELLENADO ===");
      console.log("📄 pdfBytes existe:", !!pdfBytes, "tamaño:", pdfBytes?.byteLength || 0);
      console.log("📝 Valores a rellenar:", fieldValues);
      console.log("🔢 Cantidad de campos detectados:", formFields.length);
      console.log("📋 Nombres de campos:", formFields.map(f => f.name));
      
      // Mostrar valores que tienen contenido
      const valoresConContenido = Object.entries(fieldValues).filter(([_, v]) => v !== "" && v !== false);
      console.log("✅ Campos con valores:", valoresConContenido);

      // Usar pdf-lib para rellenar PDF
      console.log("Usando pdf-lib para rellenar PDF...");
      // flatten: false para mantener el formulario AcroForm interactivo (editable)
      const filledPdfBytes = await fillPdfForm(pdfBytes, fieldValues, { flatten: false });

      // Descargar el PDF rellenado
      const filename = `${formulario?.nombre || "formulario"}-rellenado.pdf`;
      downloadPdf(filledPdfBytes, filename);
    } catch (err) {
      console.error("Error al generar PDF rellenado:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setFillingPdf(false);
    }
  }

  function handleFieldChange(fieldName, value) {
    console.log(`handleFieldChange llamado: campo="${fieldName}", valor=${value}, tipo=${typeof value}`);
    setFieldValues((prev) => {
      const newValues = {
        ...prev,
        [fieldName]: value,
      };
      console.log(`Valores actualizados para "${fieldName}":`, newValues[fieldName]);
      return newValues;
    });
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Cargando formulario...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div className="text-center max-w-md">
              <p className="font-medium">Error al cargar formulario</p>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
              <div className="flex gap-2 justify-center mt-4">
                <Button onClick={() => navigate("/formularios")} variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver
                </Button>
                <Button onClick={loadFormulario} variant="outline">
                  Reintentar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex items-center gap-2 sm:gap-4 w-full">
        <Button
          onClick={() => navigate("/formularios")}
          variant="ghost"
          size="icon"
          className="flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="w-0 flex-1">
          <h2 className="text-3xl font-bold tracking-tight truncate" title={formulario?.nombre}>
            {formulario?.nombre || "Formulario"}
          </h2>
          {!isMobile && (
            <p className="text-muted-foreground text-sm truncate">
              Detalle del formulario
            </p>
          )}
        </div>
      </div>

      {/* Editar nombre */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5 text-slate-500 flex-shrink-0" />
            <span className="truncate">Información</span>
          </CardTitle>
          <CardDescription className="truncate">
            {isMobile ? "Edita el nombre" : "Edita el nombre del formulario"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del formulario"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              disabled={saving}
            />
            <Button
              onClick={saveNombre}
              disabled={saving || !nombre.trim() || nombre === formulario?.nombre}
              size={isMobile ? "icon" : "default"}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className={cn("h-4 w-4", !isMobile && "mr-2")} />
                  {!isMobile && "Guardar"}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Gestión de PDF */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
            <span className="truncate">{isMobile ? "PDF" : "Documento PDF"}</span>
          </CardTitle>
          <CardDescription className="truncate">
            {formulario?.pdf_path ? (isMobile ? "Ver/reemplazar PDF" : "Ver o reemplazar el PDF") : "Sube un archivo PDF"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload / Replace PDF */}
          <div className="flex items-center gap-2">
            <input
              id="pdf-upload"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
              disabled={uploadingPdf}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById("pdf-upload")?.click()}
              disabled={uploadingPdf}
              className="flex-1 justify-start min-w-0 overflow-hidden"
            >
              <Upload className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate">
                {newPdfFile ? newPdfFile.name : (formulario?.pdf_path ? "Reemplazar PDF" : "Seleccionar PDF")}
              </span>
            </Button>
            {newPdfFile && (
              <>
                <Button
                  onClick={uploadPdf}
                  disabled={uploadingPdf}
                  size={isMobile ? "icon" : "default"}
                >
                  {uploadingPdf ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Save className={cn("h-4 w-4", !isMobile && "mr-2")} />
                      {!isMobile && "Subir"}
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setNewPdfFile(null);
                    const fileInput = document.getElementById("pdf-upload");
                    if (fileInput) fileInput.value = "";
                  }}
                  disabled={uploadingPdf}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
            {formulario?.pdf_path && !newPdfFile && (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDeletePdf(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Visor de PDF */}
          {pdfUrl ? (
            <div className="border rounded-lg overflow-hidden">
              <iframe
                src={pdfUrl}
                className="w-full h-[600px]"
                title="Visor de PDF"
              />
            </div>
          ) : (
            <div className="border rounded-lg p-12 flex flex-col items-center justify-center text-muted-foreground">
              <FileText className="h-12 w-12 mb-4" />
              <p>No hay PDF cargado</p>
              <p className="text-sm mt-1">Sube un archivo para visualizarlo aquí</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card para descripción de OpenAI - siempre visible cuando hay PDF */}
      {pdfUrl && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500 flex-shrink-0" />
                  <span className="truncate">{isMobile ? "Descripción IA" : "Descripción del formulario (IA)"}</span>
                </CardTitle>
                <CardDescription className="truncate">
                  {descripcion?.totalFields 
                    ? `${descripcion.totalFields} campos en ${descripcion.totalPages} páginas`
                    : descripcion?.fields?.length
                    ? `${descripcion.fields.length} campos detectados`
                    : isMobile ? "Genera descripción con IA" : "Genera una descripción con IA para entender el formulario"}
                </CardDescription>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {descripcion && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(descripcion, null, 2));
                      alert("JSON copiado al portapapeles");
                    }}
                    title="Copiar JSON"
                  >
                    <Copy className={`h-4 w-4 ${isMobile ? '' : 'mr-2'}`} />
                    {!isMobile && "Copiar"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant={descripcion ? "outline" : "default"}
                  size="sm"
                  onClick={async () => {
                    if (!pdfUrl || loadingOpenAI) return;
                    
                    console.log("🤖 Generando descripción con OpenAI GPT-4o Vision...");
                    setLoadingOpenAI(true);
                    
                    try {
                      const response = await fetch(pdfUrl);
                      const arrayBuffer = await response.arrayBuffer();
                      const arrayBufferForOpenAI = arrayBuffer.slice(0);
                      
                      const aiResponse = await getPdfFieldsWithOpenAI(arrayBufferForOpenAI);
                      console.log(`✓ OpenAI describió ${aiResponse.totalFields} campos`);
                      
                      // Guardar JSON de OpenAI en la base de datos
                      const descripcionJson = JSON.stringify(aiResponse, null, 2);
                      try {
                        await formulariosApi.update(id, { descripcion: descripcionJson });
                        console.log("✓ Descripción guardada en la base de datos");
                        setDescripcion(aiResponse);
                      } catch (updateError) {
                        console.error("Error al guardar descripción:", updateError);
                      }
                    } catch (error) {
                      console.error("Error al generar descripción:", error);
                      alert(`Error: ${error.message}`);
                    } finally {
                      setLoadingOpenAI(false);
                    }
                  }}
                  disabled={!pdfUrl || loadingOpenAI}
                  title={descripcion ? "Regenerar descripción" : "Generar descripción con IA"}
                >
                  {loadingOpenAI ? (
                    <>
                      <Loader2 className={`h-4 w-4 animate-spin ${isMobile ? '' : 'mr-2'}`} />
                      {!isMobile && "Generando..."}
                    </>
                  ) : descripcion ? (
                    <>
                      <RefreshCw className={`h-4 w-4 ${isMobile ? '' : 'mr-2'}`} />
                      {!isMobile && "Regenerar"}
                    </>
                  ) : (
                    <>
                      <Sparkles className={`h-4 w-4 ${isMobile ? '' : 'mr-2'}`} />
                      {!isMobile && "Generar"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {descripcion?.pages ? (
              // Formato nuevo: { pages: [{ page, summary, fields: string[] }] }
              <div className="space-y-3 max-h-[500px] overflow-auto">
                {descripcion.pages.map(pageData => {
                  const isExpanded = expandedPages[`desc_${pageData.page}`] ?? (pageData.page === 1);
                  
                  return (
                    <div key={pageData.page} className="border rounded-lg overflow-hidden bg-purple-50 dark:bg-purple-950/30">
                      <button
                        type="button"
                        onClick={() => setExpandedPages(prev => ({
                          ...prev,
                          [`desc_${pageData.page}`]: !isExpanded
                        }))}
                        className="w-full flex items-center gap-2 px-4 py-2.5 bg-purple-100 dark:bg-purple-900/50 hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors text-left"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                          Página {pageData.page}
                        </span>
                        <span className="text-xs text-purple-500 ml-auto">
                          {pageData.fields?.length || 0} campos
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="p-3 space-y-2">
                          {pageData.summary && (
                            <div className="bg-purple-100 dark:bg-purple-900/50 rounded p-2 mb-3 overflow-hidden">
                              <p className="text-sm text-purple-800 dark:text-purple-200 italic line-clamp-3" title={pageData.summary}>
                                {pageData.summary}
                              </p>
                            </div>
                          )}
                          {pageData.fields?.map((label, idx) => (
                            <div 
                              key={idx} 
                              className="bg-white dark:bg-slate-900 rounded border border-purple-200 dark:border-purple-800 p-2 flex items-start gap-2 overflow-hidden"
                            >
                              <span className="text-purple-500 font-medium text-sm min-w-[24px] flex-shrink-0">
                                {idx + 1}.
                              </span>
                              <p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-2" title={label}>
                                {label}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : descripcion?.fields && Array.isArray(descripcion.fields) ? (
              // Formato OpenAI directo: { fields: [{ name, label, type, position }] }
              (() => {
                // Agrupar por página
                const byPage = {};
                descripcion.fields.forEach(field => {
                  const page = field.position?.page || 1;
                  if (!byPage[page]) byPage[page] = [];
                  byPage[page].push(field);
                });
                const pages = Object.keys(byPage).map(Number).sort((a, b) => a - b);
                
                return (
                  <div className="space-y-3 max-h-[500px] overflow-auto">
                    {pages.map(pageNum => {
                      const pageFields = byPage[pageNum];
                      const isExpanded = expandedPages[`desc_${pageNum}`] ?? (pageNum === 1);
                      
                      return (
                        <div key={pageNum} className="border rounded-lg overflow-hidden bg-purple-50 dark:bg-purple-950/30">
                          <button
                            type="button"
                            onClick={() => setExpandedPages(prev => ({
                              ...prev,
                              [`desc_${pageNum}`]: !isExpanded
                            }))}
                            className="w-full flex items-center gap-2 px-4 py-2.5 bg-purple-100 dark:bg-purple-900/50 hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors text-left"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
                            )}
                            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                              Página {pageNum}
                            </span>
                            <span className="text-xs text-purple-500 ml-auto">
                              {pageFields.length} campos
                            </span>
                          </button>
                          {isExpanded && (
                            <div className="p-3 space-y-2">
                              {pageFields.map((field, idx) => (
                                <div 
                                  key={idx} 
                                  className="bg-white dark:bg-slate-900 rounded border border-purple-200 dark:border-purple-800 p-2 overflow-hidden"
                                >
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                                      field.type === 'checkbox' || field.type === 'radio'
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' 
                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                                    }`}>
                                      {field.type === 'checkbox' ? '☑' : field.type === 'radio' ? '○' : '✎'} {field.type}
                                    </span>
                                    <span className="text-xs font-mono text-slate-500 truncate max-w-[150px]" title={field.name}>
                                      {field.name}
                                    </span>
                                  </div>
                                  <p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-2" title={field.label}>
                                    {field.label}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            ) : descripcion ? (
              // Fallback para JSON no estructurado
              <div className="border rounded-lg bg-slate-50 dark:bg-slate-900 p-4 max-h-[400px] overflow-auto">
                <pre className="text-xs font-mono text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                  {JSON.stringify(descripcion, null, 2)}
                </pre>
              </div>
            ) : (
              // Estado vacío - sin descripción
              <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg bg-slate-50 dark:bg-slate-900">
                <span className="text-4xl mb-3">🤖</span>
                <p className="text-muted-foreground mb-2">No hay descripción generada</p>
                <p className="text-sm text-muted-foreground">
                  Haz clic en "Generar descripción" para que la IA analice el formulario
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sección de rellenado de formulario */}
      {pdfUrl && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2">
                  <Edit className="h-5 w-5 text-blue-500 flex-shrink-0" />
                  <span className="truncate">{isMobile ? "Formulario" : "Rellenar Formulario"}</span>
                </CardTitle>
                <CardDescription className="truncate">
                  {isMobile ? "Completa y genera PDF" : "Completa los campos del formulario y genera un PDF rellenado"}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-purple-600 border-purple-300 hover:bg-purple-100 flex-shrink-0"
                disabled={!descripcion || formFields.length === 0}
                title="Aplicar descripciones de IA a los campos"
                onClick={() => {
                  if (!descripcion || formFields.length === 0) return;
                  
                  // Agrupar campos por página
                  const fieldsByPage = {};
                  formFields.forEach(field => {
                    const page = field.position?.page || 1;
                    if (!fieldsByPage[page]) fieldsByPage[page] = [];
                    fieldsByPage[page].push(field);
                  });
                  
                  // Configuración IBAN Andorra: 22 dígitos (AD ya está prefijado en el formulario)
                  const IBAN_LENGTH = 22;
                  
                  // Función para detectar si es un campo IBAN
                  const isIbanField = (label, name) => {
                    const text = `${label || ''} ${name || ''}`.toLowerCase();
                    return text.includes('iban') || text.includes('compte');
                  };
                  
                  // Buscar índice donde está la descripción IBAN en OpenAI
                  let ibanDescIndex = -1;
                  let ibanPage = 1;
                  let ibanBaseDescription = null;
                  
                  if (descripcion.fields && Array.isArray(descripcion.fields)) {
                    // Formato: { fields: [{ name, label, position }] }
                    const ibanDescIdx = descripcion.fields.findIndex(d => 
                      isIbanField(d.label, d.name)
                    );
                    if (ibanDescIdx !== -1) {
                      ibanBaseDescription = descripcion.fields[ibanDescIdx].label;
                      ibanPage = descripcion.fields[ibanDescIdx].position?.page || 1;
                      // Contar cuántos campos hay en páginas anteriores
                      const fieldsBeforePage = descripcion.fields.filter(d => 
                        (d.position?.page || 1) < ibanPage
                      ).length;
                      const fieldsInPageBefore = descripcion.fields.filter(d => 
                        (d.position?.page || 1) === ibanPage
                      ).slice(0, descripcion.fields.filter(d => (d.position?.page || 1) === ibanPage).indexOf(descripcion.fields[ibanDescIdx])).length;
                      ibanDescIndex = fieldsBeforePage + fieldsInPageBefore;
                    }
                  }
                  
                  // Encontrar el índice global del campo IBAN en formFields
                  let ibanStartIndex = -1;
                  if (ibanBaseDescription) {
                    // Buscar el campo que corresponde a esa posición
                    const pageFields = fieldsByPage[ibanPage] || [];
                    // El índice en la página es la posición de la descripción IBAN dentro de esa página
                    const pageDescriptions = descripcion.fields?.filter(d => (d.position?.page || 1) === ibanPage) || [];
                    const ibanIdxInPage = pageDescriptions.findIndex(d => 
                      isIbanField(d.label, d.name)
                    );
                    
                    if (ibanIdxInPage !== -1 && ibanIdxInPage < pageFields.length) {
                      ibanStartIndex = formFields.indexOf(pageFields[ibanIdxInPage]);
                    }
                  }
                  
                  console.log(`🔍 IBAN detectado: índice ${ibanStartIndex}, descripción: "${ibanBaseDescription}"`);
                  
                  // Aplicar descripciones de IA a los campos
                  const enrichedFields = formFields.map((field, globalIndex) => {
                    const page = field.position?.page || 1;
                    const pageFields = fieldsByPage[page] || [];
                    const fieldIndex = pageFields.indexOf(field);
                    
                    // Caso especial: campos IBAN Andorra (22 dígitos, AD ya prefijado)
                    if (ibanStartIndex !== -1 && ibanBaseDescription) {
                      const ibanPosition = globalIndex - ibanStartIndex;
                      if (ibanPosition >= 0 && ibanPosition < IBAN_LENGTH) {
                        // Formato IBAN Andorra sin AD: 2 control + 4 banco + 4 sucursal + 12 cuenta
                        let ibanPart = '';
                        if (ibanPosition < 2) {
                          ibanPart = ' (dígitos control)';
                        } else if (ibanPosition < 6) {
                          ibanPart = ' (código banco)';
                        } else if (ibanPosition < 10) {
                          ibanPart = ' (código sucursal)';
                        } else {
                          ibanPart = ' (núm. cuenta)';
                        }
                        return {
                          ...field,
                          aiDescription: `${ibanBaseDescription} [${ibanPosition + 1}/${IBAN_LENGTH}]${ibanPart}`,
                        };
                      }
                    }
                    
                    let aiLabel = null;
                    
                    // Formato 1: { pages: [{ page, fields: string[] }] }
                    if (descripcion.pages) {
                      const aiPage = descripcion.pages.find(p => p.page === page);
                      aiLabel = aiPage?.fields?.[fieldIndex] || null;
                    } 
                    // Formato 2: { fields: [{ name, label, position }] } (respuesta directa de OpenAI)
                    else if (descripcion.fields && Array.isArray(descripcion.fields)) {
                      const pageDescriptions = descripcion.fields.filter(d => (d.position?.page || 1) === page);
                      aiLabel = pageDescriptions[fieldIndex]?.label || null;
                    }
                    // Formato 3: array directo de { label, position: { page } }
                    else if (Array.isArray(descripcion)) {
                      const pageDescriptions = descripcion.filter(d => (d.position?.page || 1) === page);
                      aiLabel = pageDescriptions[fieldIndex]?.label || null;
                    }
                    
                    return {
                      ...field,
                      aiDescription: aiLabel && aiLabel !== field.name ? aiLabel : null,
                    };
                  });
                  
                  const enrichedCount = enrichedFields.filter(f => f.aiDescription).length;
                  console.log(`✓ Aplicadas ${enrichedCount} descripciones de IA a campos`);
                  if (ibanStartIndex !== -1) {
                    console.log(`  📋 IBAN: campos ${ibanStartIndex + 1} al ${ibanStartIndex + IBAN_LENGTH} etiquetados`);
                  }
                  setFormFields(enrichedFields);
                }}
              >
                <Sparkles className={`h-4 w-4 ${isMobile ? '' : 'mr-2'}`} />
                {!isMobile && "Aplicar descripciones IA"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingFields ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Detectando campos...</span>
              </div>
            ) : formFields.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">No se detectaron campos en el PDF</p>
                <p className="text-sm text-muted-foreground">
                  El PDF puede no tener campos de formulario (AcroForm) o puede haber ocurrido un error al detectarlos.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Verifica la consola del navegador para más detalles.
                </p>
              </div>
            ) : (
              <>
                {/* Campos del formulario agrupados por página */}
                <div className="border rounded-lg overflow-hidden bg-blue-50 dark:bg-blue-950/30">
                  <div className="flex items-center gap-2 px-4 py-3 bg-blue-100 dark:bg-blue-900/50 border-b border-blue-200 dark:border-blue-800">
                    <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-semibold text-sm text-blue-700 dark:text-blue-300">
                      Campos del formulario
                    </span>
                    <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-200 dark:bg-blue-800 px-2 py-0.5 rounded-full">
                      {formFields.length} campos
                    </span>
                  </div>
                  
                  {(() => {
                    // Agrupar campos por página
                    const fieldsByPage = {};
                    formFields.forEach(field => {
                      const page = field.position?.page || 1; // Default a página 1
                      if (!fieldsByPage[page]) fieldsByPage[page] = [];
                      fieldsByPage[page].push(field);
                    });
                    
                    // Ordenar las páginas
                    const sortedPages = Object.keys(fieldsByPage).map(Number).sort((a, b) => a - b);
                    
                    return (
                      <div className="max-h-[500px] overflow-y-auto">
                        {sortedPages.map(pageNum => {
                          const pageFields = fieldsByPage[pageNum];
                          const pageLabel = pageNum === 0 ? "Sin página asignada" : `Página ${pageNum}`;
                          // Solo página 1 expandida por defecto
                          const isExpanded = expandedPages[`fields_${pageNum}`] ?? (pageNum === 1);
                          
                          return (
                            <div key={`page-${pageNum}`} className="border-b last:border-b-0 border-blue-200 dark:border-blue-800">
                              <button
                                type="button"
                                onClick={() => setExpandedPages(prev => ({
                                  ...prev,
                                  [`fields_${pageNum}`]: !isExpanded
                                }))}
                                className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-left"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                                )}
                                <span className="text-sm font-medium text-blue-600 dark:text-blue-300">{pageLabel}</span>
                                <span className="text-xs text-blue-400 ml-auto">
                                  {pageFields.length} campos
                                </span>
                              </button>
                              {isExpanded && (
                                <div className="px-4 py-3 space-y-4 bg-white dark:bg-slate-900 border-t border-blue-100 dark:border-blue-900">
                                  {pageFields.map((field) => {
                                    // Usar aiDescription si existe, sino label, sino name
                                    const displayLabel = field.aiDescription || field.label || field.name;
                                    const truncatedLabel = displayLabel.length > 60 
                                      ? displayLabel.substring(0, 60).trim() + '...' 
                                      : displayLabel;
                                    
                                    return (
                                      <div key={field.name} className="space-y-1.5 pb-3 border-b border-slate-200 dark:border-slate-700 last:border-b-0 last:pb-0">
                                        {/* Header con badge y coordenadas */}
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-xs font-mono font-medium">
                                            {field.type === "checkbox" ? `☑ ${field.name}` : `✎ ${field.name}`}
                                          </span>
                                          {field.position && (
                                            <span className="text-xs text-slate-400 font-mono">
                                              P{field.position.page} Y:{field.position.y} X:{field.position.x}
                                            </span>
                                          )}
                                          {/* Indicador de que tiene descripción IA */}
                                          {field.aiDescription && (
                                            <span className="text-xs text-emerald-600 dark:text-emerald-400">
                                              🤖
                                            </span>
                                          )}
                                        </div>
                                        
                                        {/* Label solo para campos que NO son checkbox */}
                                        {field.type !== "checkbox" && (
                                          <label
                                            htmlFor={`field-${field.name}`}
                                            className={`text-sm font-medium block break-words ${field.aiDescription ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'}`}
                                            title={displayLabel !== truncatedLabel ? displayLabel : undefined}
                                          >
                                            <span className="line-clamp-2">{truncatedLabel}</span>
                                            {field.required && (
                                              <span className="text-red-500 ml-1">*</span>
                                            )}
                                          </label>
                                        )}
                                        
                                        {field.type === "text" && (
                                          <input
                                            id={`field-${field.name}`}
                                            type="text"
                                            value={fieldValues[field.name] || ""}
                                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                            placeholder={truncatedLabel.length > 30 ? "Ingresa el valor..." : `Ingresa ${truncatedLabel}`}
                                            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                          />
                                        )}
                                        {field.type === "checkbox" && (
                                          <div className="flex items-center space-x-2">
                                            <input
                                              id={`field-${field.name}`}
                                              type="checkbox"
                                              checked={fieldValues[field.name] || false}
                                              onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <label
                                              htmlFor={`field-${field.name}`}
                                              className={`text-sm cursor-pointer break-words line-clamp-2 ${field.aiDescription ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'}`}
                                              title={displayLabel !== truncatedLabel ? displayLabel : undefined}
                                            >
                                              {truncatedLabel}
                                              {field.required && <span className="text-red-500 ml-1">*</span>}
                                            </label>
                                          </div>
                                        )}
                                        {field.type === "select" && field.options && (
                                          <select
                                            id={`field-${field.name}`}
                                            value={fieldValues[field.name] || ""}
                                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          >
                                            <option value="">Selecciona una opción</option>
                                            {field.options.map((option) => (
                                              <option key={option} value={option}>
                                                {option}
                                              </option>
                                            ))}
                                          </select>
                                        )}
                                        {field.type === "radio" && field.options && (
                                          <div className="space-y-2">
                                            {field.options.map((option) => (
                                              <div key={option} className="flex items-center space-x-2">
                                                <input
                                                  id={`field-${field.name}-${option}`}
                                                  type="radio"
                                                  name={field.name}
                                                  value={option}
                                                  checked={fieldValues[field.name] === option}
                                                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                                                />
                                                <label
                                                  htmlFor={`field-${field.name}-${option}`}
                                                  className="text-sm text-slate-600 dark:text-slate-400"
                                                >
                                                  {option}
                                                </label>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
                <div className="pt-4 space-y-2">
                  <Button
                    onClick={handleGenerateFilledPdf}
                    disabled={fillingPdf}
                    className="w-full"
                  >
                    {fillingPdf ? (
                      <>
                        <Loader2 className={cn("h-4 w-4 animate-spin", !isMobile && "mr-2")} />
                        {!isMobile && "Generando PDF..."}
                      </>
                    ) : (
                      <>
                        <Download className={cn("h-4 w-4", !isMobile && "mr-2")} />
                        {isMobile ? "Generar PDF" : "Generar PDF Rellenado"}
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}

            {/* Sección de referencia: Texto extraído del PDF - COMENTADO
            {pdfTextByPage.length > 0 && (
              <div className="border rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-900/50">
                <button
                  type="button"
                  onClick={() => setShowPdfText(!showPdfText)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-left border-b"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-slate-500 flex-shrink-0" />
                    <span className="font-semibold text-sm text-slate-700 dark:text-slate-200 truncate">
                      {isMobile ? "Texto PDF" : "Texto extraído del PDF"}
                    </span>
                    <span className="text-xs text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full flex-shrink-0">
                      {pdfTextByPage.length} pág
                    </span>
                  </div>
                  {showPdfText ? (
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  )}
                </button>
                {showPdfText && (
                  <div className="max-h-[400px] overflow-y-auto">
                    {pdfTextByPage.map((pageData) => {
                      // Solo página 1 expandida por defecto
                      const isExpanded = expandedPages[`text_${pageData.page}`] ?? (pageData.page === 1);
                      return (
                        <div key={pageData.page} className="border-b last:border-b-0 border-slate-200 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => setExpandedPages(prev => ({
                              ...prev,
                              [`text_${pageData.page}`]: !isExpanded
                            }))}
                            className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                            )}
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Página {pageData.page}</span>
                            <span className="text-xs text-slate-400 ml-auto">
                              {pageData.text.length} caracteres
                            </span>
                          </button>
                          {isExpanded && (
                            <div className="px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                              <pre className="text-xs whitespace-pre-wrap font-mono text-slate-500 dark:text-slate-400 leading-relaxed max-h-[300px] overflow-y-auto">
                                {pageData.text || "(Sin texto)"}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            */}
          </CardContent>
        </Card>
      )}

      {/* Sección de generación de datos de prueba */}
      {pdfUrl && formFields.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  <span className="truncate">{isMobile ? "Datos prueba" : "Generar datos de prueba (IA)"}</span>
                </CardTitle>
                <CardDescription className="truncate">
                  {generatedData 
                    ? `${Object.keys(generatedData.values || {}).length} valores generados`
                    : isMobile 
                      ? "Genera datos fake con IA" 
                      : "Combina campos y descripciones para generar datos de prueba coherentes"}
                </CardDescription>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {generatedData && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Aplicar datos generados al formulario
                      const newValues = { ...fieldValues };
                      Object.entries(generatedData.values || {}).forEach(([key, value]) => {
                        // Buscar el campo por nombre
                        const field = formFields.find(f => f.name === key);
                        if (field) {
                          newValues[key] = value;
                        }
                      });
                      setFieldValues(newValues);
                      console.log(`✓ Aplicados ${Object.keys(generatedData.values || {}).length} valores al formulario`);
                    }}
                    title="Aplicar datos generados al formulario"
                    className="text-green-600 border-green-300 hover:bg-green-100"
                  >
                    <Download className={`h-4 w-4 ${isMobile ? '' : 'mr-2'}`} />
                    {!isMobile && "Aplicar"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant={generatedData ? "outline" : "default"}
                  size="sm"
                  onClick={async () => {
                    if (!formFields.length || generatingData) return;
                    
                    console.log("🎲 Generando datos de prueba con IA...");
                    setGeneratingData(true);
                    
                    try {
                      // Combinar formFields con descripcion para crear estructura unificada
                      const combinedFields = formFields.map((field, index) => {
                        const page = field.position?.page || 1;
                        let description = field.aiDescription || "";
                        
                        // Si no tiene aiDescription, intentar obtenerla de descripcion
                        if (!description && descripcion) {
                          if (descripcion.pages) {
                            const pageData = descripcion.pages.find(p => p.page === page);
                            const fieldsByPage = formFields.filter(f => (f.position?.page || 1) === page);
                            const fieldIndex = fieldsByPage.indexOf(field);
                            description = pageData?.fields?.[fieldIndex] || "";
                          } else if (descripcion.fields && Array.isArray(descripcion.fields)) {
                            const pageFields = descripcion.fields.filter(f => (f.position?.page || 1) === page);
                            const fieldsByPage = formFields.filter(f => (f.position?.page || 1) === page);
                            const fieldIndex = fieldsByPage.indexOf(field);
                            description = pageFields[fieldIndex]?.label || "";
                          }
                        }
                        
                        return {
                          name: field.name,
                          type: field.type || "text",
                          description: description || `Campo ${index + 1}`,
                          page: page,
                          // Coordenadas para detectar patrones IBAN
                          position: {
                            x: field.position?.x || 0,
                            y: field.position?.y || 0,
                            width: field.position?.width || 0,
                            height: field.position?.height || 0,
                          },
                          index: index,
                        };
                      });
                      
                      console.log(`📋 Enviando ${combinedFields.length} campos a OpenAI...`);
                      
                      // Llamar a la Edge Function
                      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
                      
                      const response = await fetch(`${supabaseUrl}/functions/v1/generate-fake-data`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "Authorization": `Bearer ${supabaseKey}`,
                          "apikey": supabaseKey,
                        },
                        body: JSON.stringify({ fields: combinedFields }),
                      });
                      
                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || `Error ${response.status}`);
                      }
                      
                      const data = await response.json();
                      console.log(`✓ Generados ${Object.keys(data.values || {}).length} valores`);
                      console.log(`  Persona: ${data.persona?.nombre} ${data.persona?.apellidos}`);
                      
                      setGeneratedData(data);
                    } catch (error) {
                      console.error("Error al generar datos:", error);
                      alert(`Error: ${error.message}`);
                    } finally {
                      setGeneratingData(false);
                    }
                  }}
                  disabled={!formFields.length || generatingData}
                  title={generatedData ? "Regenerar datos de prueba" : "Generar datos de prueba con IA"}
                  className={generatedData ? "" : "bg-amber-500 hover:bg-amber-600"}
                >
                  {generatingData ? (
                    <>
                      <Loader2 className={`h-4 w-4 animate-spin ${isMobile ? '' : 'mr-2'}`} />
                      {!isMobile && "Generando..."}
                    </>
                  ) : generatedData ? (
                    <>
                      <RefreshCw className={`h-4 w-4 ${isMobile ? '' : 'mr-2'}`} />
                      {!isMobile && "Regenerar"}
                    </>
                  ) : (
                    <>
                      <Sparkles className={`h-4 w-4 ${isMobile ? '' : 'mr-2'}`} />
                      {!isMobile && "Generar"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {generatedData ? (
              <div className="space-y-4">
                {/* Datos de la persona ficticia */}
                {generatedData.persona && (
                  <div className="border rounded-lg bg-amber-50 dark:bg-amber-950/30 p-4">
                    <h4 className="font-semibold text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Persona ficticia generada
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {generatedData.persona.nombre && (
                        <div>
                          <span className="text-muted-foreground">Nombre:</span>{" "}
                          <span className="font-medium">{generatedData.persona.nombre} {generatedData.persona.apellidos}</span>
                        </div>
                      )}
                      {generatedData.persona.nif && (
                        <div>
                          <span className="text-muted-foreground">NIF:</span>{" "}
                          <span className="font-medium">{generatedData.persona.nif}</span>
                        </div>
                      )}
                      {generatedData.persona.email && (
                        <div>
                          <span className="text-muted-foreground">Email:</span>{" "}
                          <span className="font-medium truncate">{generatedData.persona.email}</span>
                        </div>
                      )}
                      {generatedData.persona.telefono && (
                        <div>
                          <span className="text-muted-foreground">Tel:</span>{" "}
                          <span className="font-medium">{generatedData.persona.telefono}</span>
                        </div>
                      )}
                      {generatedData.persona.iban && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">IBAN:</span>{" "}
                          <span className="font-mono text-xs">{generatedData.persona.iban}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Preview de valores generados */}
                <div className="border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedPages(prev => ({
                      ...prev,
                      fakeDataPreview: !prev.fakeDataPreview
                    }))}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        Valores generados ({Object.keys(generatedData.values || {}).length})
                      </span>
                    </div>
                    {expandedPages.fakeDataPreview ? (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    )}
                  </button>
                  {expandedPages.fakeDataPreview && (
                    <div className="max-h-[300px] overflow-y-auto p-3 space-y-1 bg-white dark:bg-slate-900">
                      {Object.entries(generatedData.values || {}).map(([key, value]) => (
                        <div key={key} className="flex items-start gap-2 text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                          <span className="font-mono text-xs text-slate-500 truncate max-w-[150px]" title={key}>
                            {key}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className={cn(
                            "flex-1 truncate",
                            typeof value === "boolean" 
                              ? value ? "text-green-600" : "text-red-600"
                              : "text-slate-700 dark:text-slate-200"
                          )} title={String(value)}>
                            {typeof value === "boolean" ? (value ? "✓ Sí" : "✗ No") : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Sparkles className="h-12 w-12 text-amber-300 mb-4" />
                <p className="text-muted-foreground">
                  {!descripcion 
                    ? "Primero genera una descripción con IA para obtener mejores resultados"
                    : "Haz clic en \"Generar\" para crear datos de prueba coherentes"
                  }
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {formFields.length} campos detectados
                  {descripcion && ` • ${descripcion.totalFields || descripcion.fields?.length || 0} descripciones`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmDeletePdf}
        onConfirm={deletePdf}
        onCancel={() => setConfirmDeletePdf(false)}
        title="Eliminar PDF"
        message="¿Estás seguro de que quieres eliminar el PDF? Esta acción no se puede deshacer."
      />
    </div>
  );
}
