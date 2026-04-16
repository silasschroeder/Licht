import { render, screen, fireEvent } from '@testing-library/react';
import ResourceTabs from '../ResourceTabs';

describe('ResourceTabs', () => {
  const types = ['pods', 'services', 'deployments'];
  const counts = { pods: 10, services: 5, deployments: 3 };

  it('renders all tabs', () => {
    const handleChange = jest.fn();
    render(<ResourceTabs types={types} activeType="pods" onTypeChange={handleChange} />);

    expect(screen.getByText('PODS')).toBeInTheDocument();
    expect(screen.getByText('SERVICES')).toBeInTheDocument();
    expect(screen.getByText('DEPLOYMENTS')).toBeInTheDocument();
  });

  it('highlights active tab', () => {
    const handleChange = jest.fn();
    const { container } = render(
      <ResourceTabs types={types} activeType="pods" onTypeChange={handleChange} />
    );

    const activeTab = screen.getByText('PODS').closest('button');
    expect(activeTab).toHaveClass('active');
  });

  it('calls onTypeChange when tab is clicked', () => {
    const handleChange = jest.fn();
    render(<ResourceTabs types={types} activeType="pods" onTypeChange={handleChange} />);

    fireEvent.click(screen.getByText('SERVICES'));
    expect(handleChange).toHaveBeenCalledWith('services');
  });

  it('displays counts when provided', () => {
    const handleChange = jest.fn();
    render(
      <ResourceTabs types={types} activeType="pods" onTypeChange={handleChange} counts={counts} />
    );

    expect(screen.getByText('(10)')).toBeInTheDocument();
    expect(screen.getByText('(5)')).toBeInTheDocument();
    expect(screen.getByText('(3)')).toBeInTheDocument();
  });

  it('does not display counts when not provided', () => {
    const handleChange = jest.fn();
    render(<ResourceTabs types={types} activeType="pods" onTypeChange={handleChange} />);

    expect(screen.queryByText('(10)')).not.toBeInTheDocument();
  });
});
