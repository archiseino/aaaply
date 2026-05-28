import { motion } from 'framer-motion';
import Tracker from '../components/tracker/Tracker';
import { useTrackerStore } from '../store/useTrackerStore';
import { useAppStore } from '../store/useAppStore';
import { handleEditApplication } from '../lib/actions';

export function TrackerPage() {
  const applications = useTrackerStore((s) => s.applications);
  const handleUpdateStatus = useTrackerStore((s) => s.handleUpdateStatus);
  const handleDeleteApplication = useTrackerStore(
    (s) => s.handleDeleteApplication,
  );
  const handleEditSave = useTrackerStore((s) => s.handleEditSave);
  const handleAddManualApplication = useTrackerStore(
    (s) => s.handleAddManualApplication,
  );
  const handleSyncFromSheets = useTrackerStore((s) => s.handleSyncFromSheets);
  const sheetId = useAppStore((s) => s.sheetId);

  return (
    <motion.div
      key='tracker'
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className='w-full h-full overflow-hidden flex flex-col'
    >
      <Tracker
        applications={applications}
        onUpdateStatus={handleUpdateStatus}
        onDelete={handleDeleteApplication}
        onEdit={handleEditApplication}
        onEditSave={handleEditSave}
        onAdd={handleAddManualApplication}
        sheetId={sheetId}
        onSyncFromSheets={handleSyncFromSheets}
      />
    </motion.div>
  );
}
