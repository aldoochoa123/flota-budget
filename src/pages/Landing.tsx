import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button, Logo } from "../components/ui";

const features = [
  { icon: "🔢", title: "Número de unidad", desc: "Identifica cada vehículo de un vistazo." },
  { icon: "📏", title: "Kilometraje", desc: "Registra y consulta los km de cada unidad." },
  { icon: "🧽", title: "Limpio / Sucio", desc: "El estado de presentación de cada vehículo." },
  { icon: "🔧", title: "Próximo mantenimiento", desc: "No se te pase ningún servicio con alertas." },
  { icon: "🛡️", title: "SOAT", desc: "Controla vencimientos antes de que ocurran." },
  { icon: "✅", title: "Revisión técnica", desc: "Mantén al día la inspección de cada unidad." },
  { icon: "📝", title: "Observaciones", desc: "Anota cualquier detalle importante." },
];

const steps = [
  { n: "01", title: "Carga tu flota", desc: "Importa las 161 unidades o agrégala manualmente en el panel." },
  { n: "02", title: "Registra el día", desc: "Actualiza kilometraje, estado, servicios, SOAT y revisiones." },
  { n: "03", title: "Consulta por Telegram", desc: "Pregunta /flota o /unidad desde tu celular." },
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center">
          <Logo />
        </div>
        <nav className="flex items-center gap-3">
          <Link to="/dashboard">
            <Button>Ver mi flota</Button>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-14 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-ok" />
          Panel + bot de Telegram
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl"
        >
          Controla tu flota,{" "}
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            sin complicaciones
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg"
        >
          Registra tus unidades, controla kilometraje, estado, mantenimiento, SOAT y revisiones
          técnicas, y consulta todo desde Telegram. Acceso libre, sin cuentas.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-9 flex flex-wrap items-center justify-center gap-4"
        >
          <Link to="/dashboard">
            <Button className="px-7 py-3 text-base">Ver mi flota →</Button>
          </Link>
        </motion.div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="mb-8 text-center text-2xl font-bold sm:text-3xl">
          Todo lo que necesitas de tu flota
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/50"
            >
              <div className="mb-3 text-3xl">{f.icon}</div>
              <h3 className="mb-1 font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
          <div className="flex flex-col justify-center rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-5 text-center">
            <p className="text-sm font-medium text-primary">Y mucho más en camino</p>
            <p className="mt-1 text-xs text-muted-foreground">Gastos, reportes y alertas a medida.</p>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-8 text-center text-2xl font-bold sm:text-3xl">Listo en 3 pasos</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-3 text-sm font-bold text-primary">{s.n}</div>
              <h3 className="mb-1 font-semibold">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link to="/dashboard">
            <Button className="px-8 py-3 text-base">Ver mi flota →</Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Flota Control — gestión de flota con datos propios. Hecho con ❤️ y sin tocar sistemas ajenos.
      </footer>
    </div>
  );
}
