import { Component, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import ErrorPage from '../pages/ErrorPage';

/** Filet de sécurité : une erreur de rendu affiche une page LONACI au lieu d'un écran blanc. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { erreur: boolean }> {
  state = { erreur: false };
  static getDerivedStateFromError() {
    return { erreur: true };
  }
  componentDidCatch(error: unknown) {
    console.error('Erreur de rendu', error);
  }
  render() {
    if (!this.state.erreur) return this.props.children;
    return (
      <MemoryRouter>
        <ErrorPage variant="erreur" onRetry={() => window.location.reload()} />
      </MemoryRouter>
    );
  }
}
