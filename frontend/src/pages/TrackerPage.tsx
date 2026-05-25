import { motion } from 'framer-motion';
import Tracker from '../components/tracker/Tracker';
import type { JobApplication } from '../components/tracker/Tracker';

interface TrackerPageProps {
  applications: JobApplication[];
  onUpdateStatus: (id: string, newStatus: JobApplication['status']) => void;
  onDelete: (id: string) => void;
  onEdit: (app: JobApplication) => void;
  onEditSave: (app: JobApplication) => void;
  onAdd: (app: JobApplication) => void;
  sheetId: string;
  onSyncFromSheets: () => Promise<any>;
}

export function TrackerPage({
  applications,
  onUpdateStatus,
  onDelete,
  onEdit,
  onEditSave,
  onAdd,
  sheetId,
  onSyncFromSheets,
}: TrackerPageProps) {
  return (
    <motion.div
      key="tracker"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="w-full h-full overflow-hidden flex flex-col"
    >
      <Tracker
        applications={applications}
        onUpdateStatus={onUpdateStatus}
        onDelete={onDelete}
        onEdit={onEdit}
        onEditSave={onEditSave}
        onAdd={onAdd}
        sheetId={sheetId}
        onSyncFromSheets={onSyncFromSheets}
      />
    </motion.div>
  );
}
