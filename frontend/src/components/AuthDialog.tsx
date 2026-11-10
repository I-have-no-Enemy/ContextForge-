import { useState, type FormEvent } from 'react';
import { ApiError } from '../services/api';
import { useSession } from '../lib/session';
import { useToast } from '../lib/toast';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { Tabs } from './ui/tabs';
import { Field } from './forms';

/** Seeded accounts for the live demo (backend/prisma/seed.ts). */
const DEMO = [
  { label: 'Developer', email: 'developer@contextforge.dev', password: 'DevPassword123!' },
  { label: 'Admin', email: 'admin@contextforge.dev', password: 'AdminPassword123!' },
];

export function AuthDialog() {
  const { signInRequested, closeSignIn, login, register } = useSession();
  const toast = useToast();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setErrors({});
    setFormError(undefined);
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    reset();
    const local: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) local.email = 'Enter an email address like name@example.com.';
    if (mode === 'register' && (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)))
      local.password = 'Use at least 8 characters with a letter and a number.';
    if (mode === 'login' && !password) local.password = 'Enter your password.';
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }

    setBusy(true);
    try {
      const user = mode === 'login' ? await login(email, password) : await register(email, password);
      toast(mode === 'login' ? `Signed in as ${user.email}` : `Account created. Signed in as ${user.email}`);
      setPassword('');
      closeSignIn();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') setErrors(err.fieldErrors());
      else setFormError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={signInRequested}
      onOpenChange={(o) => !o && closeSignIn()}
      title={mode === 'login' ? 'Sign in' : 'Create an account'}
      description="Browsing and config export work without an account. Sign in to submit servers and skills."
    >
      <Tabs
        label="Account"
        value={mode}
        onChange={(id) => {
          setMode(id as 'login' | 'register');
          reset();
        }}
        items={[
          { id: 'login', label: 'Sign in' },
          { id: 'register', label: 'Register' },
        ]}
      />
      <form className="form" onSubmit={submit} noValidate>
        <Field label="Email" error={errors.email}>
          {(p) => (
            <input {...p} className="cf-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
        </Field>
        <Field
          label="Password"
          error={errors.password}
          hint={mode === 'register' ? 'At least 8 characters, with a letter and a number.' : undefined}
        >
          {(p) => (
            <input
              {...p}
              className="cf-input"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        {formError && (
          <p className="form__error" role="alert">
            {formError}
          </p>
        )}
        <div className="form__acts">
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </div>
      </form>
      {mode === 'login' && (
        <div className="demo-accounts">
          <span className="cf-field__label">Demo accounts</span>
          <div className="cf-row">
            {DEMO.map((d) => (
              <Button
                key={d.label}
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEmail(d.email);
                  setPassword(d.password);
                  reset();
                }}
              >
                Fill {d.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
}
