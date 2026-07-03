import Link from "next/link";
import { getDb } from "@/db";
import { requirePartner } from "@/modules/auth/require-partner";
import { FinanceService } from "@/modules/finance/finance-service";
import {
  addExpenseAction,
  addReceivableAction,
  addRevenueAction,
  markPaidAction,
} from "./actions";

const money = (n: number) =>
  n.toLocaleString("es", { style: "currency", currency: "USD" });

export default async function FinancePage() {
  const partner = await requirePartner();
  const svc = new FinanceService(getDb());
  const today = new Date();
  const [dash, revenue, expenseRows, receivableRows] = await Promise.all([
    svc.dashboard(partner.id, today),
    svc.listRevenue(partner.id, 10),
    svc.listExpenses(partner.id, 10),
    svc.listReceivables(partner.id),
  ]);

  const st = dash.seventyThirty;
  const asesoriaPct = Math.round(st.asesoriaShare * 100);
  const marginPct = Math.round(dash.margin.margin * 100);
  const marginColor =
    dash.margin.level === "healthy"
      ? "text-emerald-300"
      : dash.margin.level === "warning"
        ? "text-amber-300"
        : "text-red-300";

  const inputClass =
    "w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-400 focus:outline-none";
  const todayStr = today.toISOString().slice(0, 10);

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Finanzas — Partner Business</h1>
            <p className="text-sm text-zinc-400">
              Ventana móvil de 90 días. Prioriza consultorías de alto valor.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            Dashboard
          </Link>
        </header>

        {/* Monitor 70/30 + margen + flujo */}
        <section className="grid gap-4 md:grid-cols-3">
          <div
            className={`rounded-lg border p-4 ${
              st.breached
                ? "border-red-800 bg-red-950/40"
                : "border-zinc-800 bg-zinc-900"
            }`}
          >
            <h2 className="text-sm font-medium text-zinc-300">Regla 70/30</h2>
            <p className="mt-1 text-2xl font-semibold">
              {asesoriaPct}%{" "}
              <span className="text-sm font-normal text-zinc-400">
                en asesorías
              </span>
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full ${st.breached ? "bg-red-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(asesoriaPct, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              {st.breached
                ? "⚠️ Las asesorías superan el 30%. Prioriza vender consultorías."
                : `Consultoría ${money(st.consultoria)} · Asesoría ${money(st.asesoria)}`}
            </p>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <h2 className="text-sm font-medium text-zinc-300">Margen neto</h2>
            <p className={`mt-1 text-2xl font-semibold ${marginColor}`}>
              {marginPct}%
            </p>
            <p className="mt-2 text-xs text-zinc-400">
              Ingresos {money(dash.margin.income)} − Costos{" "}
              {money(dash.margin.costs)} = {money(dash.margin.net)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Meta: ≥ 70–80% de margen neto.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <h2 className="text-sm font-medium text-zinc-300">
              Flujo de caja (por cobrar)
            </h2>
            <p className="mt-1 text-sm">
              Pendiente:{" "}
              <span className="font-medium">{money(dash.cashflow.pending)}</span>
            </p>
            <p className="text-sm">
              Vencido:{" "}
              <span className="font-medium text-red-300">
                {money(dash.cashflow.overdue)}
              </span>
            </p>
            <p className="text-sm">
              Cobrado:{" "}
              <span className="font-medium text-emerald-300">
                {money(dash.cashflow.collected)}
              </span>
            </p>
          </div>
        </section>

        {/* Formularios de captura */}
        <section className="grid gap-4 md:grid-cols-3">
          <form
            action={addRevenueAction}
            className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-4"
          >
            <h2 className="font-medium">+ Ingreso</h2>
            <select name="kind" className={inputClass} required>
              <option value="consultoria">Consultoría (alto valor)</option>
              <option value="asesoria_mensual">Asesoría mensual</option>
            </select>
            <input name="concept" placeholder="Concepto" required className={inputClass} />
            <input name="amount" type="number" step="0.01" min="0" placeholder="Monto USD" required className={inputClass} />
            <input name="entryDate" type="date" defaultValue={todayStr} required className={inputClass} />
            <button className="w-full rounded-md bg-white px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-zinc-200">
              Registrar ingreso
            </button>
          </form>

          <form
            action={addExpenseAction}
            className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-4"
          >
            <h2 className="font-medium">+ Gasto</h2>
            <select name="category" className={inputClass} required>
              <option value="herramientas">Herramientas</option>
              <option value="equipo">Equipo</option>
              <option value="publicidad">Publicidad</option>
              <option value="otros">Otros</option>
            </select>
            <input name="concept" placeholder="Concepto" required className={inputClass} />
            <input name="amount" type="number" step="0.01" min="0" placeholder="Monto USD" required className={inputClass} />
            <input name="entryDate" type="date" defaultValue={todayStr} required className={inputClass} />
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <input type="checkbox" name="isRecurring" /> Recurrente mensual
            </label>
            <button className="w-full rounded-md bg-white px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-zinc-200">
              Registrar gasto
            </button>
          </form>

          <form
            action={addReceivableAction}
            className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-4"
          >
            <h2 className="font-medium">+ Cuenta por cobrar</h2>
            <input name="concept" placeholder="Concepto" required className={inputClass} />
            <input name="amount" type="number" step="0.01" min="0" placeholder="Monto USD" required className={inputClass} />
            <input name="dueDate" type="date" required className={inputClass} />
            <select name="recurrence" className={inputClass}>
              <option value="">Cobro único</option>
              <option value="monthly">Recurrente mensual</option>
            </select>
            <button className="w-full rounded-md bg-white px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-zinc-200">
              Registrar cobro
            </button>
          </form>
        </section>

        {/* Cuentas por cobrar */}
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 font-medium">Cuentas por cobrar</h2>
          {receivableRows.length === 0 ? (
            <p className="text-sm text-zinc-500">Sin cuentas registradas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="pb-2">Concepto</th>
                  <th className="pb-2">Monto</th>
                  <th className="pb-2">Vence</th>
                  <th className="pb-2">Estado</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {receivableRows.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-800">
                    <td className="py-2">
                      {r.concept}
                      {r.recurrence === "monthly" && (
                        <span className="ml-2 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                          mensual
                        </span>
                      )}
                    </td>
                    <td className="py-2">{money(Number(r.amount))}</td>
                    <td className="py-2">{r.dueDate}</td>
                    <td className="py-2">
                      <span
                        className={
                          r.status === "pagado"
                            ? "text-emerald-300"
                            : r.status === "vencido"
                              ? "text-red-300"
                              : "text-amber-300"
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {r.status !== "pagado" && (
                        <form action={markPaidAction}>
                          <input type="hidden" name="receivableId" value={r.id} />
                          <button className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-800">
                            Marcar pagado
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Últimos movimientos */}
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <h2 className="mb-2 font-medium">Últimos ingresos</h2>
            {revenue.map((r) => (
              <p key={r.id} className="border-t border-zinc-800 py-1.5 text-sm">
                <span className="text-zinc-400">{r.entryDate}</span> · {r.concept}{" "}
                <span className="float-right">{money(Number(r.amount))}</span>
              </p>
            ))}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <h2 className="mb-2 font-medium">Últimos gastos</h2>
            {expenseRows.map((e) => (
              <p key={e.id} className="border-t border-zinc-800 py-1.5 text-sm">
                <span className="text-zinc-400">{e.entryDate}</span> · {e.concept}{" "}
                <span className="float-right">{money(Number(e.amount))}</span>
              </p>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
