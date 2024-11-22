import React, { useEffect, useState } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from 'recharts';
import styles from './MemoryUsageChart.module.css';

const MemoryUsageChart = ({ data, containerRef }) => {
    // console.log('Received data:', data); // Log the received data

    // Ensure data is an array and has elements
    const validData = Array.isArray(data) && data.length > 0 ? data : [];

    // console.log('Valid data:', validData); // Log the valid data

    // Early return if no valid data is provided
    if (validData.length === 0) {
        // console.log('No valid data available'); // Log when no valid data
        return (
            <div className="">
                <p className="">No memory usage data available</p>
            </div>
        );
    }

    // Process the data to match the chart requirements
    const processedData = validData.map(item => ({
        timeElapsed: item.timestamp,
        usedSize: item.usedSize / (1024 * 1024) // Convert bytes to MB
    }));



    const peakMemory = Math.max(...processedData.map(m => m.usedSize || 0));
    const lastMeasurement = processedData[processedData.length - 1] || {};
    const loadTime = lastMeasurement.timeElapsed || 0;

    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    const [chartDimensions, setChartDimensions] = useState({
        width: isMobile ? 200 : 400,
        height: 200
    });

    useEffect(() => {
        setChartDimensions({
            width: isMobile ? 280 : 400,
            height: 200
        });
    }, [isMobile]);


    return (
        <div className={`${styles.container}`}>
            <div>

                <h2 className={styles.title}>Heap through load</h2>
                <LineChart
                    data={processedData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    width={chartDimensions.width}
                    height={chartDimensions.height}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="timeElapsed"
                        label={{ value: 'Time (ms)', position: 'insideBottomRight', offset: -10 }}
                        tickFormatter={(value) => `${value}`}
                    />
                    <YAxis
                        label={{ value: 'Memory (MB)', angle: -90, position: 'insideBottomLeft', offset: 15 }}
                    />
                    <Tooltip
                        formatter={(value, name) => [
                            `${value.toFixed(2)} MB`,
                            name === 'usedSize' ? 'Used Heap Size' : name
                        ]}
                        labelFormatter={(value) => `Time: ${value}ms`}
                        contentStyle={{ width: '20px', height: '20px', backgroundColor: 'transparent', border: 'none' }}
                    />
                    <Legend />
                    <Line
                        type="monotone"
                        dataKey="usedSize"
                        stroke="#8884d8"
                        name="Used Heap Size"
                        strokeWidth={3}
                        dot={false}
                    />
                </LineChart>
            </div>

            {containerRef && (
                <div className={styles.details}>
                    <div className={styles.performance}>
                        <h5>Performance </h5>
                        <p className={styles.dataValue}>Total Load Time: <p className={styles.enlargedDataValue}>{loadTime} MS</p></p>
                        <p className={styles.dataValue}>Peak Memory: <p className={styles.enlargedDataValue}>{peakMemory.toFixed(2)} MB</p></p>
                    </div>

                    <div className={styles.finalMeasurement}>
                        <h5 className="">Final Measurement</h5>
                        <p className={styles.dataValue}>Used Heap Size: <p className={styles.enlargedDataValue}>{lastMeasurement.usedSize?.toFixed(2) || 0} MB</p></p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MemoryUsageChart;
