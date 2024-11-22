import { useState, useEffect, useRef } from 'react'
import 'whatwg-fetch';
import './App.css'
import MemoryUsageChart from './MemoryUsageChart/MemoryUsageChart.jsx';
import Logo from '../public/logoSvg.svg';
import searchIcon from '../public/search-icon-gray.svg';
import loadingIcon from '../public/loading.svg';

import repeat from '../public/repeat.png'

import expandIcon from '../public/expand.svg';
import collapseIcon from '../public/collapse.svg';
import ScoreCircle from './ScoreCircle/ScoreCircle.jsx';


function App() {
    const [message, setMessage] = useState('')
    const [timeToTitle, setTimeToTitle] = useState('')
    const [timetorender, setTimeToRender] = useState('')
    const [timetointerct, setTimeToInteract] = useState('')
    const [fcp, setFcp] = useState({ numericValue: null, displayValue: null })
    const [lcp, setLcp] = useState({ numericValue: null, displayValue: null })
    const [cls, setCls] = useState({ numericValue: null, displayValue: null })
    const [si, setSi] = useState({ numericValue: null, displayValue: null })
    const [ttfb, setTtfb] = useState(null)
    const [cpuUsage, setCpuUsage] = useState('')
    const [memoryUsage, setMemoryUsage] = useState('')
    const [websocketUsage, setWebsocketUsage] = useState([])
    const [memoryData, setMemoryData] = useState([])
    const [isTracking, setIsTracking] = useState(false)
    const url = useRef('');
    const [progress, setProgress] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [sec4Expand, setSec4Expand] = useState(false);
    const [scores, setScores] = useState({
        accessibility: null,
        bestPractices: null,
        performance: null,
        seo: null
    });

    const isMobile = /Mobi|Android/i.test(navigator.userAgent);


    const setMemoryDataWithStorage = (data) => {
        setMemoryData(data);
        localStorage.setItem('memoryData', JSON.stringify(data));
    };

    const setTimeToInteractWithStorage = (time) => {
        setTimeToInteract(time);
        localStorage.setItem('timeToInteract', time);
    };

    const setTtfbWithStorage = (value) => {
        setTtfb(value);
        localStorage.setItem('ttfb', value);
    };

    const setTimeToRenderWithStorage = (time) => {
        setTimeToRender(time);
        localStorage.setItem('timeToRender', time);
    };

    const setTimeToTitleWithStorage = (time) => {
        setTimeToTitle(time);
        localStorage.setItem('timeToTitle', time);
    };

    const setCpuUsageWithStorage = (usage) => {
        setCpuUsage(usage);
        localStorage.setItem('cpuUsage', usage);
    };

    const setScoresWithStorage = (scores) => {
        setScores(scores);
        localStorage.setItem('scores', JSON.stringify(scores));
    };

    const setFcpWithStorage = (fcpData) => {
        setFcp(fcpData);
        localStorage.setItem('fcp', JSON.stringify(fcpData));
    };

    const setLcpWithStorage = (lcpData) => {
        setLcp(lcpData);
        localStorage.setItem('lcp', JSON.stringify(lcpData));
    };

    const setClsWithStorage = (clsData) => {
        setCls(clsData);
        localStorage.setItem('cls', JSON.stringify(clsData));
    };

    const setSiWithStorage = (siData) => {
        setSi(siData);
        localStorage.setItem('si', JSON.stringify(siData));
    };





    useEffect(() => {
        const storedMemoryData = localStorage.getItem('memoryData');
        if (storedMemoryData) setMemoryData(JSON.parse(storedMemoryData));

        const storedTimeToInteract = localStorage.getItem('timeToInteract');
        if (storedTimeToInteract) setTimeToInteract(storedTimeToInteract);

        const storedTtfb = localStorage.getItem('ttfb');
        if (storedTtfb) setTtfb(storedTtfb);

        const storedTimeToRender = localStorage.getItem('timeToRender');
        if (storedTimeToRender) setTimeToRender(storedTimeToRender);

        const storedTimeToTitle = localStorage.getItem('timeToTitle');
        if (storedTimeToTitle) setTimeToTitle(storedTimeToTitle);

        const storedCpuUsage = localStorage.getItem('cpuUsage');
        if (storedCpuUsage) setCpuUsage(storedCpuUsage);

        const storedScores = localStorage.getItem('scores');
        if (storedScores) setScores(JSON.parse(storedScores));

        const storedFcp = localStorage.getItem('fcp');
        if (storedFcp) setFcp(JSON.parse(storedFcp));

        const storedLcp = localStorage.getItem('lcp');
        if (storedLcp) setLcp(JSON.parse(storedLcp));

        const storedCls = localStorage.getItem('cls');
        if (storedCls) setCls(JSON.parse(storedCls));

        const storedSi = localStorage.getItem('si');
        if (storedSi) setSi(JSON.parse(storedSi));


        if (storedMemoryData || storedScores) {
            setIsTracking(true);
        }
    }, []);



    const showErrorMessage = (message) => {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #f44336;
      color: white;
      padding: 15px;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 1000;
     animation: fadeIn 0.3s, fadeOut 0.3s 2.7s;
    `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);

        setTimeout(() => {
            document.body.removeChild(errorDiv);
        }, 3000);
    };




    const analyzeAll = async (url) => {

        clearAllStates();

        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }



        if (!url.trim()) {
            showErrorMessage("Please enter a URL 1.");
            return;
        }


        // const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-])\/?$/;
        const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)\/?$/i;

        if (!urlPattern.test(url)) {
            showErrorMessage("Invalid URL. Please enter a valid URL 2.");
            return;
        }

        // Add https:// if the URL doesn't start with http:// or https://

        // Recheck if the URL is valid after adding https://
        if (!urlPattern.test(url)) {
            showErrorMessage("Invalid URL. Please enter a valid URL 3.");
            return;
        }

        try {
            setIsLogo(false);
            setIsLoading(true);
            // setIsTracking(true);

            const response = await fetch('http://192.168.68.110:5000/api/analyze-all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let data;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n\n');
                lines.forEach(line => {
                    if (line.startsWith('data: ')) {
                        const progressData = JSON.parse(line.slice(6));
                        console.log('Progress:', progressData);
                        setProgress(progressData);
                        if (progressData.stage === 'complete') {
                            setIsTracking(true);
                            setIsLoading(false);
                            data = progressData.data;
                        }
                    }
                });
            }

            setMemoryDataWithStorage(data.results.heapSnapshot);
            setTimeToInteractWithStorage(data.results.interactiveTime.timeToInteractive);
            setTtfbWithStorage(data.results.lighthouseAnalysis.metrics.timeToFirstByte.numericValue);
            setTimeToRenderWithStorage(data.results.renderTime.timeToRender);
            setTimeToTitleWithStorage(data.results.titleTime.timeToTitle);
            setCpuUsageWithStorage(data.results.renderTime.cpuUsagePercentage);
            setScoresWithStorage(data.results.lighthouseAnalysis.scores);
            setFcpWithStorage({ numericValue: data.results.lighthouseAnalysis.metrics.fcp.numericValue, displayValue: data.results.lighthouseAnalysis.metrics.fcp.displayValue });
            setLcpWithStorage({ numericValue: data.results.lighthouseAnalysis.metrics.lcp.numericValue, displayValue: data.results.lighthouseAnalysis.metrics.lcp.displayValue });
            setClsWithStorage({ numericValue: data.results.lighthouseAnalysis.metrics.cls.numericValue, displayValue: data.results.lighthouseAnalysis.metrics.cls.displayValue });
            setSiWithStorage({ numericValue: data.results.lighthouseAnalysis.metrics.si.numericValue, displayValue: data.results.lighthouseAnalysis.metrics.si.displayValue });
            data.socketAnalysis.connections.forEach((connection) => {
                setWebsocketUsage((prevWebsocketUsage) => [
                    ...prevWebsocketUsage,
                    connection,
                ]);
            });
        } catch (error) {
            console.error('Error analyzing URL:', error);
            // showErrorMessage("An error occurred while analyzing the URL. Please try again.", error);
            showErrorMessage(error);

        }
    };




    const heapSnapshot = async (url) => {
        const response = await fetch('http://localhost:5000/api/heap-snapshot', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });
        const data = await response.json();
        console.log(data)
        setMemoryData(data.heapData);
    };


    const handleSec4Expand = () => {
        setSec4Expand(!sec4Expand);
        const section4Element = document.querySelector('.section-4');
        const viewportWidth = window.innerWidth;

        if (section4Element) {

            if (!isMobile && viewportWidth > 768) {
                section4Element.classList.toggle('expanded');

            }

            else {
                section4Element.classList.toggle('expanded_mobile');

            }
        }
    }
    useEffect(() => {
        const handleClickOutside = (event) => {
            const section4Element = document.querySelector('.section-4');
            if (section4Element && !section4Element.contains(event.target) && sec4Expand) {
                setSec4Expand(false);
                section4Element.classList.remove('expanded');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [sec4Expand]);



    useEffect(() => {
        fetch('/api/test')
            .then(res => res.json())
            .then(data => setMessage(data.message))
            .catch(err => console.error(err))
    }, [])




    const clearAllStates = () => {
        setMemoryData(null);
        setTimeToInteract(null);
        setTtfb(null);
        setTimeToRender(null);
        setTimeToTitle(null);
        setCpuUsage(null);
        setScores(null);
        setFcp(null);
        setLcp(null);
        setCls(null);
        setSi(null);

        localStorage.removeItem('memoryData');
        localStorage.removeItem('timeToInteract');
        localStorage.removeItem('ttfb');
        localStorage.removeItem('timeToRender');
        localStorage.removeItem('timeToTitle');
        localStorage.removeItem('cpuUsage');
        localStorage.removeItem('scores');
        localStorage.removeItem('fcp');
        localStorage.removeItem('lcp');
        localStorage.removeItem('cls');
        localStorage.removeItem('si');
    };






    const [isLogo, setIsLogo] = useState(true);
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current) {
            const playVideo = async () => {
                try {
                    await videoRef.current.play();
                    console.log(isMobile);

                } catch (error) {
                    console.error("Autoplay failed:", error);
                    console.log(isMobile);
                }
            };
            playVideo();
        }
    }, []);


    const handleHomeReturn = () => {
        clearAllStates();

        setIsTracking(false);
        setIsLogo(true);
    }



    return (
        <div className='main-container'>
            <div className="top-banner">
                <div className="logo hide"> <img src={Logo} alt="Logo" style={{ width: '80px', height: "80px" }} /></div>
                <div className="input">
                    <img src={searchIcon} alt="search" style={{ width: '20px', height: "20px" }} />
                    <form onSubmit={(e) => { e.preventDefault(); analyzeAll(url.current); }} className='input_form'>
                        <input type="text" placeholder="Enter URL" onChange={(e) => url.current = e.target.value} />
                        <button type="submit">Track</button>
                    </form>
                </div>
            </div>
            <div className="empty-main-container">
                {isTracking && (
                    <div className="mainDivs">
                        <div className='timingDiv'>
                            <div className="section-1">
                                <div className="paint-info">
                                    <div className='paint-info-fcp'>
                                        <p>
                                            Time to FCP
                                        </p>
                                        <p style={{
                                            color: fcp?.numericValue <= 1800 ? 'green' : fcp.numericValue <= 3000 ? 'yellow' : 'red'
                                        }}>
                                            {fcp.displayValue}
                                        </p>
                                    </div>
                                    <div className='paint-info-lcp'>
                                        <p>
                                            Time to LCP
                                        </p>
                                        <p style={{
                                            color: lcp?.numericValue <= 2500 ? 'green' : lcp.numericValue <= 4000 ? 'yellow' : 'red'
                                        }}>
                                            {lcp.displayValue}
                                        </p>
                                    </div>
                                    <div className="paint-info-cls">
                                        <p>
                                            CLS
                                        </p>
                                        <p style={{
                                            color: cls?.numericValue < 0.1 ? 'green' : cls.numericValue <= 0.25 ? 'yellow' : 'red'
                                        }}>
                                            {cls.displayValue}
                                        </p>
                                    </div>
                                    <div className="paint-info-si">
                                        <p>
                                            speed index
                                        </p>
                                        <p style={{
                                            color: si?.numericValue <= 3400 ? 'green' : si.numericValue <= 5800 ? 'yellow' : 'red'
                                        }}>
                                            {si.displayValue}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="section-2">
                                <div className="section-2-1">
                                    <div className="section2data">
                                        <div>
                                            Time to Title
                                        </div>
                                        <div className='data_content'>
                                            {timeToTitle ? parseFloat(timeToTitle).toFixed(2) : 'n/a'}
                                            <p>ms</p>
                                        </div>
                                    </div>
                                    <div className="section2data">
                                        <div>
                                            Time to render
                                        </div>
                                        <div className='data_content'>

                                            {timetorender ? parseFloat(timetorender).toFixed(2) : 'n/a'}
                                            <p>ms</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="section-2-2">
                                    <div className="section2data">
                                        <div>
                                            Time to interact:
                                        </div>
                                        <div className='data_content'>
                                            {/* {timetointerct} */}
                                            {timetointerct ? parseFloat(timetointerct).toFixed(2) : 'n/a'}
                                            <p>ms</p>
                                        </div>
                                    </div>
                                    <div className="section2data">
                                        <div>
                                            TTFB:
                                        </div>
                                        <div className='data_content'>
                                            {/* {ttfb} */}
                                            <p>
                                                {ttfb ? parseFloat(ttfb).toFixed(2) : 'n/a'}
                                            </p>
                                            <p>ms</p>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                        <div className="other-info">
                            <div className="section-4" >

                                <img src={sec4Expand ? collapseIcon : expandIcon} className="expand-btn" alt="expand" onClick={() => { handleSec4Expand() }} />
                                <div className="memory-stats">
                                    {memoryData.length > 0 && <MemoryUsageChart data={memoryData} containerRef={sec4Expand} />}
                                </div>
                            </div>

                            <div className="section-3">
                                <div className="scores">
                                    <div className="score-item">

                                        <ScoreCircle score={scores.accessibility} label="Accessibility" />
                                    </div>
                                    <div className="score-item">

                                        <ScoreCircle score={scores.bestPractices} label="Best Practices" />
                                    </div>
                                    <div className="score-item">

                                        <ScoreCircle score={scores.performance} label="Performance" />
                                    </div>
                                    <div className="score-item">

                                        <ScoreCircle score={scores.seo} label="SEO" />
                                    </div>
                                </div>
                                <div className="systemInfo">
                                    <div className="cpu-stats">

                                        <div style={{ fontFamily: "var(--f-sec)" }}>CPU Usage</div>
                                        <div style={{ fontFamily: "var(--f-main)" }}> {cpuUsage} %</div>


                                    </div>
                                    <div className="socket-stats" style={{ fontFamily: "var(--f-sec)" }}>
                                        {websocketUsage.length === 0 ? (
                                            <h4>No websockets available</h4>
                                        ) : (
                                            <h4>Websocket Usage:</h4>
                                        )}
                                        {websocketUsage.map((connection, index) => (
                                            <div key={index}>
                                                {connection.url}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                )}

            </div>


            {isLoading && (
                <div className="loadingDiv">
                    <div className="loadingContianer">
                        <div className="loading-icon">
                            <img src={loadingIcon} alt="loading " />
                        </div>
                        <div className="progress">
                            {progress.stage}
                        </div>
                    </div>



                </div>
            )}



            <div className={`logo-container ${isLogo ? 'center' : 'none'}`} style={{ height: '100px', width: '100px' }}>
                {(isLogo && !isTracking) && (
                    <div>
                        {isMobile ? (
                            <img
                                src="./grey-left1.png"
                                alt="Logo"
                                className="logo-image"
                                height="100"
                                width="100"
                            />
                        ) : (
                            <video
                                autoPlay
                                muted
                                playsInline
                                className="logo-video"
                                height="100"
                                width="100"
                            >
                                <source src="/logo.mp4" type="video/mp4" />
                                Your browser does not support the video tag.
                            </video>
                        )}
                    </div>
                )}
            </div>

            <img className='info-icon' src={repeat} alt="info" style={{ width: '20px', height: "20px" }} onClick={handleHomeReturn} />

        </div>
    )
}

export default App
