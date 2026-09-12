export default function NoPermission() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <span className="text-4xl" aria-hidden>
        🚫
      </span>
      <h2 className="text-lg font-semibold text-verde-profundo">Sem permissão</h2>
      <p className="text-sm text-verde-oliva">Você não tem acesso a esta área.</p>
    </div>
  );
}
