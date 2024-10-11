import { useState, useEffect } from 'react'
import 'whatwg-fetch';
import './App.css'
import MemoryUsageChart from './MemoryUsageChart.jsx';

function App() {
  const [message, setMessage] = useState('')
  const [timeToTitle, setTimeToTitle] = useState('')
  const [timetorender, setTimeToRender] = useState('')
  const [timetointerct, setTimeToInteract] = useState('')
  const [fcp, setFcp] = useState('')  
  const [lcp, setLcp] = useState('')  
  const [ttfb, setTtfb] = useState(null)
  const [cpuUsage, setCpuUsage] = useState('')
  const [memoryUsage, setMemoryUsage] = useState('')
  const [websocketUsage, setWebsocketUsage] = useState([])
  const [memoryData, setMemoryData] = useState([])  


  ///MEASURE TITLE TIME
  const measureTitleTime = async (url) => {
    try {
      const response = await fetch('http://localhost:5000/api/measure-title-time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      console.log(data); 
      setTimeToTitle(data.timeToTitle); 
      return data;
    } catch (error) {
      console.error('Error measuring title time:', error);
      throw error;
    }
  };

  //MEASURE RENDER TIME
 
  const measureRenderTime = async (url) => {
    try {
      const response = await fetch('http://localhost:5000/api/measure-render-time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      console.log(data); 
      setTimeToRender(data.timeToRender);
      setFcp(data.firstPaint); 
      setLcp(data.largestContentfulPaint);
      return data;
    } catch (error) {
      console.error('Error measuring title time:', error);
      throw error;
    }
  };

  const measureInteractiveTime = async (url) => {
    try {
      const response = await fetch('http://localhost:5000/api/measure-interactive-time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      console.log( data); 
      setTimeToInteract(data.timeToInteractive);
      return data;
    } catch (error) {
      console.error('Error measuring title time:', error);
      throw error;
    }
  };

  const measureTTFB = async (url) => {
    try {
      const response = await fetch('http://localhost:5000/api/measure-ttfb-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      console.log( data); 
      // setTimeToInteract(data.timeToInteractive);
      setTtfb(data.ttfb);
      return data;
    } catch (error) {
      console.error('Error measuring title time:', error);
      throw error;
    }
  };


  const cpu_memory_usage = async (url) => {
    try {
      const response = await fetch('http://localhost:5000/api/monitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      console.log( data); 
      setCpuUsage(data.initialMetrics.cpu.user);
      setMemoryUsage(data.initialMetrics.memory.heapUsed);
      return data;
    } catch (error) {
      console.error('Error measuring title time:', error);
      throw error;
    }
  };

  const websocket_usage = async (url) => {
    try {
      const response = await fetch('http://localhost:5000/api/analyze-sockets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      console.log( data); 
      data.connections.map((connection) => {
        setWebsocketUsage((prevWebsocketUsage) => [
          ...prevWebsocketUsage,
          connection, 
        ]);
      });
      return data;
    } catch (error) {
      console.error('Error measuring title time:', error);
      throw error;  
    }
  };


  const trackMemory = async (url) => {
    const response = await fetch('http://localhost:5000/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({url})
    });
    const data = await response.json();
    console.log(data)
    // setMemoryData(data);
  };


  useEffect(() => {
    fetch('/api/test')
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(err => console.error(err))
  }, [])

  

  return (
    <div>
      <h5>Message from backend: {message}</h5>
      <div className="mainDivs">
        <div className='timingDiv'>
          <div className="section-1">
            <div className="timing-title">
              <h3>time-info</h3>
            </div>
            <div className="paint-info">
              <div className='paint-info-fcp'>Time to FCP: {fcp}</div>
              <div className='paint-info-lcp'>Time to LCP: {lcp}</div>
            </div>  
          </div>
          <div className="section-2">
            <div>Time to Title: {timeToTitle}</div>
            <div>Time to render: {timetorender}</div>
            <div>Time to interact: {timetointerct}</div>
            <div>TTFB: {ttfb}</div>   
          </div>
        </div>
        <div className="other-info">

        <div className="section-3">
        <div className="cpu-stats">
          <h2>CPU Stats</h2>
          <h4>CPU Usage: {cpuUsage}</h4>
          <h4>Memory Usage: {memoryUsage} </h4>
        </div>
        <div className="sockect-stats">
          <h2>Websocket Stats</h2>
          {websocketUsage.map((connection, index) => (
          <div key={index}>
            {connection.url}
          </div>
           ))}
        </div>
        </div>
        <div className="section-4">
          <div className="memory-stats">
          {((memoryData)!=[]) && <MemoryUsageChart data={memoryData} />}
          </div>
        </div>
      </div>

        
      </div>
   
      
      <div className='TimeButton'>
        <button onClick={()=>measureTitleTime('https://experienceoman.om/')}>title time</button>
        <button onClick={()=>measureRenderTime('https://experienceoman.om/')}>Render time website</button>
        <button onClick={()=>measureInteractiveTime('https://experienceoman.om/')}>interactive time website</button>
        <button onClick={()=>measureTTFB('https://experienceoman.om/')}> ttfb website</button>
        <button onClick={() => cpu_memory_usage('https://experienceoman.om/')}> cpu memory usage</button>
        <button onClick={() => websocket_usage('https://multiuser-fluid.glitch.me/')}> websocket usage</button>
        <button onClick={() => trackMemory('https://example.com/')}> memory_load</button>

      </div>
   

    </div>
  )
}

export default App
