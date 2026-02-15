import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/Dashboard.module.css';

export default function Dashboard() {
  const { currentFarm, userProfile } = useAuth();

  if (!currentFarm) {
    return (
      <Layout>
        <div style={{ padding: '2rem' }}>
          <h2>Bem-vindo, {userProfile?.name || 'Usuário'}!</h2>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={styles.container}>
        <h1>📊 {currentFarm.name}</h1>
        <p>Olá, {userProfile?.name}!</p>
      </div>
    </Layout>
  );
}
