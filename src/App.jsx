import React, { useState, useEffect } from 'react';
import './index.css';

const API_BASE_URL = 'https://api-datos-tienda.onrender.com/api';

function App() {
  const [cajas, setCajas] = useState([]);
  const [cajaId, setCajaId] = useState('');
  
  // Tabs de Navegación
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tabData, setTabData] = useState(null);
  const [dashboardVentas, setDashboardVentas] = useState([]); // Para cálculos de fecha
  
  // Fecha local para el filtro (YYYY-MM-DD)
  const today = new Date();
  const localDateStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  const [filterDate, setFilterDate] = useState(localDateStr);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // UI States
  const [showVentasDia, setShowVentasDia] = useState(false);

  // 1. Obtener Cajas al iniciar
  useEffect(() => {
    fetch(`${API_BASE_URL}/cajas`)
      .then(res => res.json())
      .then(data => {
        setCajas(data);
        if (data.length > 0) {
          setCajaId(data[0].id);
        } else {
          setLoading(false);
          setError('No hay cajas registradas todavía.');
        }
      })
      .catch(err => {
        setError('Error conectando a la API de Render.');
        setLoading(false);
      });
  }, []);

  // 2. Obtener la información de la Caja seleccionada y la Pestaña activa
  useEffect(() => {
    if (!cajaId) return;
    setLoading(true);
    setError('');
    setTabData(null);
    setCurrentPage(1); // Resetear a la página 1 al cambiar de pestaña
    
    if (activeTab === 'dashboard') {
      // Para el Dashboard, descargamos el Resumen Y las Ventas puras para poder filtrarlas por fecha
      Promise.all([
        fetch(`${API_BASE_URL}/cajas/${cajaId}/dashboard`).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE_URL}/cajas/${cajaId}/ventas`).then(r => r.ok ? r.json() : [])
      ]).then(([dashData, ventasData]) => {
        setTabData(dashData);
        setDashboardVentas(Array.isArray(ventasData) ? ventasData : []);
        setLoading(false);
      }).catch(err => {
        setError('Error al cargar datos del dashboard.');
        setLoading(false);
      });
    } else {
      const endpoint = `${API_BASE_URL}/cajas/${cajaId}/${activeTab}`;
      fetch(endpoint)
        .then(res => {
          if (!res.ok) throw new Error('Información no encontrada');
          return res.json();
        })
        .then(data => {
          setTabData(data);
          setLoading(false);
        })
        .catch(err => {
          setError(`Aún no hay datos de ${activeTab} sincronizados para esta terminal.`);
          setLoading(false);
        });
    }
  }, [cajaId, activeTab]);

  // Generador de Tabla Inteligente para Listas
  const renderDataList = (data, type) => {
    if (!data) return <div className="empty-state">La lista de {type} está vacía.</div>;
    
    let safeData = Array.isArray(data) ? data : [data];
    if (safeData.length === 0 || !safeData[0]) {
      return <div className="empty-state">La lista de {type} está vacía o sin formato.</div>;
    }
    
    const columns = Object.keys(safeData[0]).filter(k => k !== '_id' && k !== 'createdAt' && k !== 'updatedAt');
    
    // Motor de Paginación
    const totalPages = Math.ceil(safeData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentData = safeData.slice(startIndex, startIndex + itemsPerPage);
    
    return (
      <div className="table-container glass-panel" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col} style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid var(--surface-border)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {col.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentData.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {columns.map(col => {
                  let val = row[col];
                  if (val === undefined || val === null || val === '') {
                    return <td key={col} style={{ padding: '1rem' }}>-</td>;
                  }

                  // Si es un arreglo (Productos, Devoluciones)
                  if (Array.isArray(val)) {
                    if (val.length === 0) return <td key={col} style={{ padding: '1rem' }}>-</td>;
                    return (
                      <td key={col} style={{ padding: '0.5rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {val.map((item, idx) => (
                            <div key={idx} className="array-item" style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', width: 'max-content' }}>
                              <span>{item.nombre || item.codigo || 'Item'} {item.motivo ? `(${item.motivo})` : ''}</span>
                              <span style={{ fontWeight: 'bold', marginLeft: '6px' }}>x{item.cantidad || 1}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    );
                  }

                  // Si es un objeto (Cliente)
                  if (typeof val === 'object') {
                    val = val.nombre || JSON.stringify(val);
                  }

                  // Formateo especial
                  let displayValue = val.toString();
                  if (col.toLowerCase().includes('fecha')) {
                    displayValue = new Date(val).toLocaleString();
                  } else if (col.toLowerCase().includes('total') || col.toLowerCase().includes('monto')) {
                    displayValue = `$${Number(val).toFixed(2)}`;
                  }

                  return (
                    <td key={col} style={{ padding: '1rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {displayValue}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Controles de Paginación */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button 
               className="select-modern" 
               style={{ padding: '0.5rem 1rem', background: 'var(--surface-light)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1, width: 'auto' }}
               onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
               disabled={currentPage === 1}
            >
              ← Anterior
            </button>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Página {currentPage}</strong> de {totalPages} <br/>
              <span style={{ fontSize: '0.75rem' }}>({safeData.length} registros en total)</span>
            </div>
            <button 
               className="select-modern" 
               style={{ padding: '0.5rem 1rem', background: 'var(--surface-light)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1, width: 'auto' }}
               onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
               disabled={currentPage === totalPages}
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderDashboard = () => {
    if (!tabData) return null;

    // Filtrar ventas por fecha seleccionada (ajustando a zona horaria local y protegiendo de fechas corruptas)
    const ventasDelDia = dashboardVentas.filter(v => {
      if (!v.fecha) return false;
      const vDateObj = new Date(v.fecha);
      if (isNaN(vDateObj.getTime())) return false; // Escudo contra fechas inválidas
      
      const vDateStr = new Date(vDateObj.getTime() - (vDateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      return vDateStr === filterDate;
    });

    const ingresosDelDia = ventasDelDia.reduce((sum, v) => sum + (Number(v.total) || 0), 0);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Filtro de Fecha */}
        <div className="glass-panel card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderTop: '4px solid var(--accent-success)' }}>
          <label className="stat-title" style={{ margin: 0, fontSize: '1.1rem' }}>📅 Consultar Día:</label>
          <input 
            type="date" 
            className="select-modern" 
            value={filterDate} 
            onChange={e => setFilterDate(e.target.value)}
            style={{ padding: '0.6rem', width: 'auto', fontSize: '1rem', fontWeight: 'bold' }}
          />
        </div>

        {/* Resumen del Día Seleccionado */}
        <div className="stats-grid">
          <div 
            className="glass-panel card" 
            style={{ borderTop: '4px solid #3b82f6', cursor: 'pointer', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-2px)' } }}
            onClick={() => {
              setShowVentasDia(!showVentasDia);
              setCurrentPage(1); // Reset pagination for the sub-list
            }}
          >
            <div className="stat-title">Ventas del Día <br/><small style={{color:'#60a5fa'}}>(👆 Clic para ver lista)</small></div>
            <div className="stat-value">{ventasDelDia.length}</div>
          </div>
          <div className="glass-panel card" style={{ borderTop: '4px solid #10b981' }}>
            <div className="stat-title">Ingresos del Día (USD)</div>
            <div className="stat-value money">${ingresosDelDia.toFixed(2)}</div>
          </div>
          <div className="glass-panel card">
            <div className="stat-title">Total Productos en Tienda</div>
            <div className="stat-value products">{tabData.resumen?.totalProductos || 0}</div>
          </div>
          <div className="glass-panel card">
            <div className="stat-title">Total Clientes en Tienda</div>
            <div className="stat-value clients">{tabData.resumen?.totalClientes || 0}</div>
          </div>
        </div>

        {/* Historico Global */}
        <div className="stats-grid" style={{ marginTop: '0.5rem' }}>
          <div className="glass-panel card" style={{ opacity: 0.7 }}>
            <div className="stat-title">Ventas Históricas (Todos los tiempos)</div>
            <div className="stat-value" style={{ fontSize: '1.5rem' }}>{tabData.resumen?.ventasTotalesHistoricas || 0}</div>
          </div>
          <div className="glass-panel card" style={{ opacity: 0.7 }}>
            <div className="stat-title">Ingresos Históricos (Todos los tiempos)</div>
            <div className="stat-value money" style={{ fontSize: '1.5rem' }}>${(tabData.resumen?.ingresosTotalesHistoricos || 0).toFixed(2)}</div>
          </div>
        </div>

        {/* Detalle de Ventas del Día Desplegable */}
        {showVentasDia && (
          <div style={{ marginTop: '1rem', animation: 'fadeIn 0.3s ease-in-out' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.5rem' }}>
              🧾 Detalle de Ventas ({filterDate})
            </h3>
            {renderDataList(ventasDelDia, 'Ventas del Día Seleccionado')}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <header>
        <h1>Gestor Operativo Central</h1>
        <div style={{ color: 'var(--accent-success)', fontWeight: 'bold' }}>🔴 ONLINE</div>
      </header>

      <div className="selector-container glass-panel card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label className="stat-title" style={{ display: 'block', marginBottom: '0.8rem' }}>Terminal Registradora</label>
          <select className="select-modern" value={cajaId} onChange={(e) => setCajaId(e.target.value)}>
            {cajas.map(c => (
              <option key={c.id} value={c.id}>{c.nombrePC} - {c.ip}</option>
            ))}
          </select>
        </div>
        
        {/* Pestañas de Navegación (Tabs) */}
        <div className="tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', marginTop: '0.5rem' }}>
          {['dashboard', 'clientes', 'productos', 'proveedores', 'ventas'].map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)}
              className="select-modern"
              style={{
                background: activeTab === tab ? 'var(--accent-primary)' : 'rgba(15, 23, 42, 0.8)',
                border: activeTab === tab ? '1px solid #60a5fa' : '1px solid var(--surface-border)',
                width: 'auto', 
                padding: '0.6rem 1.5rem', 
                textTransform: 'capitalize',
                fontWeight: activeTab === tab ? 'bold' : 'normal'
              }}
            >
              {tab === 'dashboard' ? 'Resumen General' : tab}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="loading">Descargando {activeTab}...</div>}
      {!loading && error && <div className="empty-state">{error}</div>}

      {!loading && !error && tabData && (
        <div style={{ marginTop: '2rem' }}>
          {activeTab === 'dashboard' ? renderDashboard() : renderDataList(tabData, activeTab)}
        </div>
      )}
    </>
  );
}

export default App;
