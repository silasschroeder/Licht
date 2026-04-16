import { render, screen, fireEvent } from '@testing-library/react';
import ResourceTable from '../ResourceTable';

describe('ResourceTable', () => {
  const mockData = [
    { name: 'pod-1', namespace: 'default', status: 'Running', age: '5m' },
    { name: 'pod-2', namespace: 'default', status: 'Pending', age: '2m' },
  ];

  const mockColumns = [
    { key: 'name', label: 'Name' },
    { key: 'namespace', label: 'Namespace' },
    { key: 'status', label: 'Status' },
    { key: 'age', label: 'Age' },
  ];

  it('renders table with data', () => {
    render(<ResourceTable data={mockData} columns={mockColumns} />);

    expect(screen.getByText('pod-1')).toBeInTheDocument();
    expect(screen.getByText('pod-2')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<ResourceTable data={mockData} columns={mockColumns} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Namespace')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
  });

  it('calls onRowClick when row is clicked', () => {
    const handleClick = jest.fn();
    render(<ResourceTable data={mockData} columns={mockColumns} onRowClick={handleClick} />);

    const firstRow = screen.getByText('pod-1').closest('tr');
    if (firstRow) {
      fireEvent.click(firstRow);
      expect(handleClick).toHaveBeenCalledWith(mockData[0]);
    }
  });

  it('highlights row when highlightId matches', () => {
    const { container } = render(
      <ResourceTable
        data={[{ id: 'pod-1', name: 'pod-1', namespace: 'default' }]}
        columns={mockColumns}
        highlightId="pod-1"
      />
    );

    const highlightedRow = container.querySelector('.highlighted');
    expect(highlightedRow).toBeInTheDocument();
  });

  it('renders empty table when no data', () => {
    render(<ResourceTable data={[]} columns={mockColumns} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.queryByText('pod-1')).not.toBeInTheDocument();
  });

  it('uses custom render function for columns', () => {
    const columnsWithRender = [
      {
        key: 'status',
        label: 'Status',
        render: (value: string) => <span className="status-badge">{value}</span>,
      },
    ];

    render(<ResourceTable data={mockData} columns={columnsWithRender} />);

    const badge = screen.getByText('Running').closest('.status-badge');
    expect(badge).toBeInTheDocument();
  });
});
