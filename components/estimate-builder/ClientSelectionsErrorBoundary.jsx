import { Component } from "react";

// Kept in its own module on purpose. Fast Refresh cannot preserve a class component: whenever the
// module that defines one is re-evaluated, the class and everything it wraps are remounted. Inside
// EstimateBuilderWorkbook.js that meant any edit reaching that file reset Client Selections.
export default class ClientSelectionsErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[Client Selections] component mount error", error, info);
    this.setState({ info });
    this.props.onError?.(error, info);
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, info: null });
    }
  }

  render() {
    if (this.state.error) {
      return this.props.renderError({ error: this.state.error, info: this.state.info, source: "react-boundary" });
    }
    return this.props.children;
  }
}
