export function Footer() {
  return (
    <footer className="border-t">
      <div className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-center gap-4 md:flex-row">
          <p className="text-sm" style={{ color: "orange" }}>
            © {new Date().getFullYear()} - TheLab by el Mati 🔥
          </p>
        </div>
      </div>
    </footer>
  );
}
