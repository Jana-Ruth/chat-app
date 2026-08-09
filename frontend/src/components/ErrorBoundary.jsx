import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-error-screen">
          <div>
            <h1>Something went wrong</h1>
            <p>{this.state.error.message || 'The app could not display this page.'}</p>
            <button type="button" onClick={() => window.location.reload()}>Reload app</button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}