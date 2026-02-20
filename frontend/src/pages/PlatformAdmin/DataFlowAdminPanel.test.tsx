import { render, screen, fireEvent } from '@testing-library/react';
import DataFlowAdminPanel from './DataFlowAdminPanel';

describe('DataFlowAdminPanel', () => {
  it('renders title and monitoring panel', () => {
    render(<DataFlowAdminPanel />);
    expect(screen.getByText(/Data Flow Visualization/i)).toBeInTheDocument();
    expect(screen.getByText(/Monitoring & Traceability/i)).toBeInTheDocument();
  });

  it('can add a node via admin controls', () => {
    render(<DataFlowAdminPanel />);
    const addNodeBtn = screen.getByText('Add Node');
    fireEvent.click(addNodeBtn);
    expect(screen.getByText(/Node/)).toBeInTheDocument();
  });
});
