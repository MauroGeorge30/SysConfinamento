import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import styles from '../styles/Login.module.css';

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      setError('Email ou senha inválidos');
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.box}>
        <div className={styles.logo}>🐂</div>
        <h1>Sistema de Confinamento</h1>
        <p>Gerenciamento de Gado</p>

        <form onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}

          <div>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
