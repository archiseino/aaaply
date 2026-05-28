import { motion } from 'framer-motion';
import JobFinder from '../components/jobfinder/JobFinder';
import { useNotificationStore } from '../store/useNotificationStore';
import { useTrackerStore } from '../store/useTrackerStore';
import { handleJobFinderApply } from '../lib/actions';

export function JobFinderPage() {
  const notify = useNotificationStore((s) => s.notify);
  const handleAddExternal = useTrackerStore(
    (s) => s.handleAddManualApplication,
  );

  return (
    <motion.div
      key='jobfinder'
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className='w-full h-full overflow-hidden flex flex-col'
    >
      <JobFinder
        onApply={handleJobFinderApply}
        onAddExternalApplication={handleAddExternal}
        notify={notify}
      />
    </motion.div>
  );
}
