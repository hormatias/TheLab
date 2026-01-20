export function Footer() {
  return (
    <footer className="border-t">
      <div className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} TheLab. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
