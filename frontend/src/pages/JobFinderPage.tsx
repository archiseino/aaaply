import { motion } from 'framer-motion';
import JobFinder from '../components/jobfinder/JobFinder';
import type { JobApplication } from '../components/tracker/Tracker';
import type { ToastType } from '../components/ui/Toast';

interface JobFinderPageProps {
  onApply: (job: any) => void;
  onAddExternalApplication: (app: JobApplication) => void;
  notify: (msg: string, type?: ToastType) => void;
}

export function JobFinderPage({ onApply, onAddExternalApplication, notify }: JobFinderPageProps) {
  return (
    <motion.div
      key="jobfinder"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="w-full h-full overflow-hidden flex flex-col"
    >
      <JobFinder
        onApply={onApply}
        onAddExternalApplication={onAddExternalApplication}
        notify={notify}
      />
    </motion.div>
  );
}
