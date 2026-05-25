import React from 'react';
import { Filter, ChevronDown } from 'lucide-react';

type ApplicationStatus = 'All' | 'Applied' | 'No Response' | 'Interviewing' | 'Approve' | 'Decline';

interface StatusFilterProps {
  currentStatus: ApplicationStatus;
  onStatusChange: (status: ApplicationStatus) => void;
}

const StatusFilter: React.FC<StatusFilterProps> = ({ currentStatus, onStatusChange }) => {
  const statuses: ApplicationStatus[] = ['All', 'Applied', 'No Response', 'Interviewing', 'Approve', 'Decline'];

  return (
    <div className="relative group min-w-[140px]">
      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none" style={{ color: 'var(--text-muted)' }}>
        <Filter size={16} />
      </div>
      <select
        value={currentStatus}
        onChange={(e) => onStatusChange(e.target.value as ApplicationStatus)}
        className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm appearance-none cursor-pointer focus:outline-none transition-all"
        style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
        }}
      >
        {statuses.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none" style={{ color: 'var(--text-muted)' }}>
        <ChevronDown size={16} />
      </div>
    </div>
  );
};

export default StatusFilter;
