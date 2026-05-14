import React from 'react';

class TestErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('AptitudeTest crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#f9fafb', padding: '24px',
        }}>
          <div style={{
            maxWidth: '440px', width: '100%',
            backgroundColor: 'white', borderRadius: '16px',
            border: '1px solid #fca5a5', padding: '32px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ color: '#b91c1c', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
              Test Failed to Load
            </h2>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '12px' }}>
              An error occurred while starting the test. Please refresh and try again.
            </p>
            <div style={{
              backgroundColor: '#f3f4f6', borderRadius: '8px',
              padding: '12px', marginBottom: '20px',
              textAlign: 'left', fontFamily: 'monospace',
              fontSize: '11px', color: '#374151', wordBreak: 'break-word',
            }}>
              {this.state.error?.message || 'Unknown error'}
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%', backgroundColor: '#1e3a5f',
                color: 'white', border: 'none', borderRadius: '12px',
                padding: '12px', fontSize: '15px', fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Refresh &amp; Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default TestErrorBoundary;
