import React, { createContext, useContext, useState, useEffect } from "react";

const JobStatusContext = createContext();

export const useJobStatus = () => useContext(JobStatusContext);

export const JobStatusProvider = ({ children }) => {
  const [jobStatusMap, setJobStatusMap] = useState({});

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("jobStatusMap");
    if (saved) {
      setJobStatusMap(JSON.parse(saved));
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem("jobStatusMap", JSON.stringify(jobStatusMap));
  }, [jobStatusMap]);

  return (
    <JobStatusContext.Provider value={{ jobStatusMap, setJobStatusMap }}>
      {children}
    </JobStatusContext.Provider>
  );
};