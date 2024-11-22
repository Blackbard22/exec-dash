import React from 'react';

const ScoreCircle = ({ score, label }) => {
    const size = 100;
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    const getColor = (score) => {
        if (score >= 90) return "#4CAF50"; // Green
        if (score >= 50) return "#FFA500"; // Yellow
        return "#FF0000"; // Red
    };

    const circleColor = getColor(score);

    return (
        <div className="score-item-container">
            <svg width={size} height={size} className="">
                <circle
                    stroke="#e6e6e6"
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                <circle
                    stroke={circleColor}
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    style={{ strokeDashoffset }}
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
            </svg>
            <div className="">
                <p className="" style={{ fontFamily: 'var(--f-main)' }}>{score}</p>
                <p style={{ fontFamily: 'var(--f-sec)' }}>{label}</p>
            </div>
        </div>
    );
};


export default ScoreCircle;



