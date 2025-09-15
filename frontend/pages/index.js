import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
  // Use NEXT_PUBLIC_API_URL if set, else use relative path (works for both local and Vercel)
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  const res = await fetch(`${base}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        router.push('/notes');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error');
    }
    setLoading(false);
  }

  return (
    <div className="login-bg">
      <div className="card">
        <div className="brand">
          <span className="logo">📝</span>
          <h1>Notes SaaS</h1>
        </div>
        <form onSubmit={handleLogin} autoComplete="on">
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus maxLength={60} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required maxLength={32} />
          <button type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
        </form>
        {error && <p className="error">{error}</p>}
        <div className="hint">
          <b>Demo accounts:</b>
          <ul className="demo-list">
            <li>admin@acme.test <span className="role">(Admin, Acme)</span> / <span className="pw">password</span></li>
            <li>user@acme.test <span className="role">(Member, Acme)</span> / <span className="pw">password</span></li>
            <li>admin@globex.test <span className="role">(Admin, Globex)</span> / <span className="pw">password</span></li>
            <li>user@globex.test <span className="role">(Member, Globex)</span> / <span className="pw">password</span></li>
          </ul>
        </div>
      </div>
      <style jsx>{`
        .login-bg {
          min-height: 100vh;
          background: linear-gradient(135deg, #6a82fb 0%, #fc5c7d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .card {
          background: #fff;
          border-radius: 18px;
          box-shadow: 0 8px 32px #0002;
          padding: 2.5rem 2rem 2rem 2rem;
          max-width: 350px;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        .logo {
          font-size: 2.2rem;
          margin-bottom: 0.5rem;
        }
        h1 {
          font-size: 2rem;
          margin: 0;
          font-weight: 700;
          color: #333;
        }
        form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
        }
        input {
          padding: 0.9rem 1.1rem;
          font-size: 1.05rem;
          border: 1px solid #e0e0e0;
          border-radius: 7px;
          background: #fafbfc;
          transition: border 0.2s;
        }
        input:focus {
          border: 1.5px solid #6a82fb;
          outline: none;
        }
        button {
          padding: 1rem 1.1rem;
          font-size: 1.1rem;
          background: linear-gradient(90deg, #6a82fb 0%, #fc5c7d 100%);
          color: #fff;
          border: none;
          border-radius: 7px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .error {
          color: #e53935;
          background: #fff0f0;
          border-radius: 4px;
          padding: 0.5rem 1rem;
          margin: 1rem 0 0 0;
          text-align: center;
        }
        .hint {
          margin-top: 2rem;
          font-size: 0.97rem;
          color: #888;
          text-align: center;
        }
        .demo-list {
          margin: 0.7rem 0 0 0;
          padding: 0;
          list-style: none;
        }
        .demo-list li {
          margin-bottom: 0.3rem;
          font-size: 0.97rem;
        }
        .role {
          color: #6a82fb;
          font-weight: 500;
        }
        .pw {
          color: #fc5c7d;
          font-weight: 500;
        }
        @media (max-width: 500px) {
          .card {
            max-width: 98vw;
            padding: 1.2rem 0.5rem 1.2rem 0.5rem;
          }
          h1 {
            font-size: 1.3rem;
          }
          input, button {
            font-size: 0.98rem;
          }
        }
      `}</style>
    </div>
  );
}
