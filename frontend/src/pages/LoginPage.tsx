import { useMutation } from '@apollo/client/react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { DomainErrorAlert, fieldError, type DomainErrorLike } from '../components/DomainErrorAlert';
import { ClipboardIcon, PillIcon, UserIcon } from '../components/icons';
import { IconCircle } from '../components/ui';
import { LoginMutation, RegisterMutation } from '../graphql/operations';

const DEMO_ACCOUNTS = [
  { label: 'Paciente demo', email: 'paciente@afirmativepill.co', password: 'Paciente123*', icon: UserIcon },
  { label: 'Farmacéutico demo', email: 'farmacia@afirmativepill.co', password: 'Farmacia123*', icon: ClipboardIcon },
];

export function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ email: '', password: '', fullName: '', documentNumber: '' });
  const [error, setError] = useState<DomainErrorLike | null>(null);
  const [login, loginState] = useMutation(LoginMutation);
  const [register, registerState] = useMutation(RegisterMutation);
  const busy = loginState.loading || registerState.loading;

  if (user) return <Navigate to={user.role === 'PHARMACIST' ? '/farmacia' : '/'} replace />;

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const result =
      mode === 'login'
        ? (await login({ variables: { input: { email: form.email, password: form.password } } })).data?.login
        : (await register({ variables: { input: form } })).data?.register;
    if (!result) return;
    if (result.__typename !== 'AuthPayload') {
      setError(result as DomainErrorLike);
      return;
    }
    await signIn(result.token);
    const next = params.get('next');
    navigate(next ?? (result.user.role === 'PHARMACIST' ? '/farmacia' : '/'), { replace: true });
  }

  return (
    <div className="mx-auto max-w-md space-y-6 pt-4">
      <div className="flex flex-col items-center text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-white shadow-brand">
          <PillIcon className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
          {mode === 'login' ? 'Ingresa a tu cuenta' : 'Crea tu cuenta'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === 'login'
            ? 'Compra tus medicamentos y sigue tus pedidos en tiempo real.'
            : 'Regístrate para comprar en línea y recibir en casa.'}
        </p>
      </div>

      <div className="card p-6 sm:p-7">
        <div className="mb-6 grid grid-cols-2 rounded-full bg-slate-100 p-1 text-sm font-semibold">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`rounded-full py-2 transition ${mode === m ? 'bg-brand-600 text-white shadow-brand' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {m === 'login' ? 'Ingresar' : 'Registrarme'}
            </button>
          ))}
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <div>
                <label className="label" htmlFor="fullName">
                  Nombre completo
                </label>
                <input id="fullName" className="input" required value={form.fullName} onChange={update('fullName')} />
                <FieldHint message={fieldError(error, 'fullName')} />
              </div>
              <div>
                <label className="label" htmlFor="documentNumber">
                  Documento de identidad
                </label>
                <input
                  id="documentNumber"
                  className="input"
                  required
                  inputMode="numeric"
                  value={form.documentNumber}
                  onChange={update('documentNumber')}
                />
                <FieldHint message={fieldError(error, 'documentNumber')} />
              </div>
            </>
          )}
          <div>
            <label className="label" htmlFor="email">
              Correo electrónico
            </label>
            <input id="email" type="email" autoComplete="email" className="input" required value={form.email} onChange={update('email')} />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="input"
              required
              value={form.password}
              onChange={update('password')}
            />
            <FieldHint message={fieldError(error, 'password')} />
          </div>

          {error && !error.fieldErrors?.length && <DomainErrorAlert error={error} />}

          <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
            {busy ? 'Procesando…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
          </button>
        </form>
      </div>

      {/* Accesos rápidos para probar en local; no se incluyen en el build de producción. */}
      {import.meta.env.DEV && mode === 'login' && (
        <div className="card p-5">
          <p className="mb-3 text-xs font-medium text-slate-400">Cuentas de demostración</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3 text-left text-sm transition hover:border-brand-200 hover:bg-brand-50/40"
                onClick={() => setForm((f) => ({ ...f, email: a.email, password: a.password }))}
              >
                <IconCircle size="sm">
                  <a.icon className="h-4 w-4" />
                </IconCircle>
                <span className="min-w-0">
                  <span className="block font-semibold text-slate-800">{a.label}</span>
                  <span className="block truncate text-xs text-slate-500">{a.email}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldHint({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs font-medium text-rose-700">{message}</p> : null;
}
