// filename: frontend/src/App.test.tsx
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Montera', () => {
  render(<App />);
  expect(screen.getByText(/Montera/i)).toBeInTheDocument();
});