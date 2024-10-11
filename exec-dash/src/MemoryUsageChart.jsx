import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const MemoryUsageChart = ({ data }) => {
  // Ensure data is an array and has elements
  const validData = Array.isArray(data) && data.length > 0 ? data : [];

  // Early return if no valid data is provided
  if (validData.length === 0) {
    return (
      <div className="w-full h-[600px] p-4 flex items-center justify-center">
        <p className="text-gray-500">No memory usage data available</p>
      </div>
    );
  }

  const peakMemory = Math.max(...validData.map(m => m.jsHeapSize || 0));
  const lastMeasurement = validData[validData.length - 1] || {};
  const loadTime = lastMeasurement.timeElapsed || 0;

  return (
    <div className="w-full h-[600px] p-4">
      <h2 className="text-xl font-bold mb-4">Website Memory Usage Over Time</h2>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={validData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="timeElapsed" 
            label={{ value: 'Time (ms)', position: 'bottom' }}
            tickFormatter={(value) => `${value}ms`}
          />
          <YAxis 
            label={{ value: 'Memory (MB)', angle: -90, position: 'left' }}
          />
          <Tooltip 
            formatter={(value, name) => [
              `${value} MB`,
              name.replace(/([A-Z])/g, ' $1').trim()
            ]}
            labelFormatter={(value) => `Time: ${value}ms`}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="jsHeapSize" 
            stroke="#8884d8" 
            name="JS Heap Size"
            strokeWidth={2}
          />
          <Line 
            type="monotone" 
            dataKey="totalHeapSize" 
            stroke="#82ca9d" 
            name="Total Heap Size"
            strokeWidth={2}
          />
          <Line 
            type="monotone" 
            dataKey="processMemory" 
            stroke="#ffc658" 
            name="Process Memory"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
      
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Performance Summary</h3>
          <p>Total Load Time: {loadTime}ms</p>
          <p>Peak Memory: {peakMemory} MB</p>
          <p>Final DOM Nodes: {lastMeasurement.domNodes || 0}</p>
        </div>
        
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Final Measurements</h3>
          <p>JS Heap Size: {lastMeasurement.jsHeapSize || 0} MB</p>
          <p>Total Heap Size: {lastMeasurement.totalHeapSize || 0} MB</p>
          <p>Heap Limit: {lastMeasurement.heapLimit || 0} MB</p>
        </div>
      </div>
    </div>
  );
};

export default MemoryUsageChart;