import React, { useEffect, useState, useRef } from 'react';

export default function KitchenDashboard() {
  const [orders, setOrders] = useState([]);
  const [accepted, setAccepted] = useState(new Set(JSON.parse(localStorage.getItem('acceptedOrders') || '[]')));
  const [seenOrders, setSeenOrders] = useState(new Set());
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showAccepted, setShowAccepted] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [readMessages, setReadMessages] = useState(new Set(JSON.parse(localStorage.getItem('readMessages') || '[]')));
  const [clearedMessages, setClearedMessages] = useState(new Set(JSON.parse(localStorage.getItem('clearedMessages') || '[]')));
  const [showCleared, setShowCleared] = useState(false);
  const alarmIntervalRef = useRef(null);
  const alarmAudio = useRef(null);
  const messageAudio = useRef(null);

  // Set audio files for alerts
  useEffect(() => {
    alarmAudio.current = new Audio('/alert.mp3');
    messageAudio.current = new Audio('/message-alert.mp3');
  }, []);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch orders and messages every 5 seconds
  useEffect(() => {
    if (!audioEnabled) return;

    const fetchOrders = async () => {
      const res = await fetch('https://qsr-orders-default-rtdb.firebaseio.com/orders.json');
      const data = await res.json();
      const orderArray = Object.entries(data || {}).map(([id, order]) => ({ id, ...order }));

      orderArray.sort((a, b) => new Date(b['Order Date']) - new Date(a['Order Date']));
      setOrders(orderArray);

      // Check for new unseen orders
      const newUnseenOrder = orderArray.find(order => !seenOrders.has(order.id) && !accepted.has(order.id) && order['Order Items']);
      if (newUnseenOrder) {
        setSeenOrders(prev => new Set(prev).add(newUnseenOrder.id));
        triggerAlarm(newUnseenOrder.id, newUnseenOrder['Order Type']); // Trigger alarm when a new order is found
      }

      // Check for new unseen messages
      orderArray.forEach(order => {
        if (order.Message_Reason && !readMessages.has(order.id)) {
          setReadMessages(prev => {
            const updated = new Set(prev).add(order.id);
            localStorage.setItem('readMessages', JSON.stringify(Array.from(updated)));
            return updated;
          });

          // Play message audio alert if it's a message order
          if (order['Order Type'] && order['Order Type'].toUpperCase() === 'MESSAGE') {
            messageAudio.current?.play(); // Play message audio if it's a message
            triggerAlarm(order.id, 'MESSAGE'); // Trigger alarm for MESSAGE orders
          }
        }

        // Play alert audio for PICK UP and DELIVERY orders
        if ((order['Order Type'].toUpperCase() === 'PICK UP' || order['Order Type'].toUpperCase() === 'DELIVERY') && !accepted.has(order.id)) {
          alarmAudio.current?.play(); // Play alert audio for PICK UP and DELIVERY orders
          triggerAlarm(order.id, order['Order Type']); // Trigger alarm for PICK UP and DELIVERY orders
        }
      });
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [audioEnabled]);

  // Trigger alarm for new orders or messages
  const triggerAlarm = (orderId, orderType) => {
    console.log(`Triggering alarm for ${orderType}:`, orderId);
    if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);

    // Set an interval to play the alarm sound every 10 seconds
    alarmIntervalRef.current = setInterval(() => {
      if (orderType === 'PICK UP' || orderType === 'DELIVERY') {
        if (!accepted.has(orderId)) {
          alarmAudio.current.play(); // Play alert sound for PICK UP or DELIVERY orders
        } else {
          clearInterval(alarmIntervalRef.current); // Stop alarm when order is accepted
        }
      } else if (orderType === 'MESSAGE') {
        if (!readMessages.has(orderId)) {
          messageAudio.current.play(); // Play message audio for MESSAGE orders
        } else {
          clearInterval(alarmIntervalRef.current); // Stop alarm when message is read
        }
      }
    }, 10000); // Repeats every 10 seconds
  };

  // Accept an order
  const acceptOrder = async (id) => {
    const timestamp = new Date().toISOString();
    setAccepted(prev => {
      const updated = new Set(prev).add(id); // Add order to accepted set
      localStorage.setItem('acceptedOrders', JSON.stringify(Array.from(updated))); // Save accepted orders to localStorage
      return updated;
    });
    await fetch(`https://qsr-orders-default-rtdb.firebaseio.com/orders/${id}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ "Accepted At": timestamp })
    });
    clearInterval(alarmIntervalRef.current); // Stop alarm when order is accepted
  };

  // Mark message as read and move it to cleared messages
  const markMessageRead = (id) => {
    setReadMessages(prev => {
      const updated = new Set(prev).add(id);
      localStorage.setItem('readMessages', JSON.stringify(Array.from(updated)));
      return updated;
    });

    setClearedMessages(prev => {
      const updated = new Set(prev).add(id);
      localStorage.setItem('clearedMessages', JSON.stringify(Array.from(updated)));
      return updated;
    });

    // Stop message audio alert when the message is read
    if (messageAudio.current) {
      messageAudio.current.pause();
      messageAudio.current.currentTime = 0; // Reset the audio
    }
    clearInterval(alarmIntervalRef.current); // Stop alarm when message is read
  };

  // Clear a message
  const clearMessage = (id) => {
    setClearedMessages(prev => {
      const updated = new Set(prev).add(id);
      localStorage.setItem('clearedMessages', JSON.stringify(Array.from(updated)));
      return updated;
    });
  };

  // Only display orders if audio is enabled
  if (!audioEnabled) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Orders and Messages</h1>
        <p>Please click the button below to start the dashboard and enable sound alerts.</p>
        <button onClick={() => setAudioEnabled(true)} style={{ fontSize: '1.2rem', padding: '0.5rem 1rem' }}>
          Start Dashboard
        </button>
      </div>
    );
  }

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  // Function to format date to 'YYYY-MM-DD' for reliable comparison
  const formatDate = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  };

  // Get today's date in 'YYYY-MM-DD' format
  const todayStr = formatDate(today);

  // Calculate orders today count
  const dailyOrderCount = orders.filter(order => {
    const orderDate = new Date(order['Order Date']);
    const formattedOrderDate = formatDate(orderDate); // Format the order date to compare
    return formattedOrderDate === todayStr; // Compare only the date part
  }).length;

  // Calculate elapsed time since order
  const getElapsedTime = (dateStr) => {
    const orderDate = new Date(dateStr);
    if (isNaN(orderDate)) return "Invalid date"; // Handle edge case if order date is invalid
    const elapsed = now - orderDate; // Ensure time difference from now
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${minutes}m ${seconds}s ago`;
  };

  const formattedDate = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const displayedOrders = orders.filter(order => {
    const isAcceptedOrder = accepted.has(order.id);
    const isInDateRange = formatDate(new Date(order['Order Date'])) === todayStr;
    return showAccepted ? isAcceptedOrder && isInDateRange : !isAcceptedOrder && isInDateRange;
  }).sort((a, b) => new Date(b['Order Date']) - new Date(a['Order Date']));

  return (
    <div style={{ padding: '1rem', fontFamily: 'Arial' }}>
      <h1>Orders and Messages - California Winston Churchill</h1>
      <p><strong>Date:</strong> {formattedDate}</p>
      <p><strong>Orders Today:</strong> {dailyOrderCount}</p>

      <button onClick={() => setShowAccepted(prev => !prev)} style={{ marginRight: '1rem', backgroundColor: 'red', color: 'white', padding: '0.5rem 1rem' }}>
        {showAccepted ? 'Hide Accepted Orders' : 'View Accepted Orders'}
      </button>
      <button onClick={() => setShowCleared(prev => !prev)} style={{ backgroundColor: '#007bff', color: 'white', padding: '0.5rem 1rem' }}>
        {showCleared ? 'Hide Cleared Messages' : 'View Cleared Messages'}
      </button>

      {/* Displaying messages */}
      {orders.filter(order => (order['Order Type'] || '').toUpperCase() === 'MESSAGE').map(msg => (
        <div key={msg.id} style={{ border: '2px solid #f00', backgroundColor: readMessages.has(msg.id) ? '#eee' : '#fffbcc', padding: '1rem', marginTop: '1rem', borderRadius: '8px' }}>
          <h3>Incoming Message</h3>
          <p><strong>Message Date:</strong> {msg['Message Date']}</p>
          <p><strong>Caller Name:</strong> {msg['Caller_Name']}</p>
          <p><strong>Phone:</strong> {msg['Caller_Phone']}</p>
          <p><strong>Reason:</strong> {msg['Message_Reason']}</p>
          <button onClick={() => markMessageRead(msg.id)} style={{ backgroundColor: readMessages.has(msg.id) ? 'green' : 'red', color: 'white', marginRight: '1rem', padding: '0.5rem 1rem' }}>
            {readMessages.has(msg.id) ? 'READ' : 'READ MESSAGE'}
          </button>
          {readMessages.has(msg.id) && (
            <button onClick={() => clearMessage(msg.id)} style={{ backgroundColor: 'gray', color: 'white', padding: '0.5rem 1rem' }}>CLEAR</button>
          )}
        </div>
      ))}

      <div style={{ display: 'grid', gap: '1rem', marginTop: '2rem' }}>
        {/* Displaying orders */}
        {displayedOrders.map(order => (
          <div key={order.id} style={{ border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px', fontSize: '1.2rem' }}>
            <h2>Order #{order['Order ID']}</h2>
            <p><strong>Customer:</strong> {order['Customer Name']}</p>
            <p><strong>Order Type:</strong> {order['Order Type'] || 'N/A'}</p>
            {order['Order Type']?.toLowerCase() === 'delivery' && <p><strong>Delivery Address:</strong> {order['Delivery Address']}</p>}
            <p><strong>Order Date:</strong> {order['Order Date']}</p>
            {showAccepted && order['Accepted At'] && (
              <p style={{ color: 'green', fontWeight: 'bold' }}><strong>Accepted At:</strong> {new Date(order['Accepted At']).toLocaleString()}</p>
            )}
            {!showAccepted && order['Order Date'] && (
              <p><strong>Elapsed Time:</strong> <span style={{ color: 'goldenrod' }}>{getElapsedTime(order['Order Date'])}</span></p>
            )}
            <p style={{ color: 'red', fontWeight: 'bold' }}><strong>Pickup Time:</strong> {order['Pickup Time']}</p>
            <p><strong>Total:</strong> {order['Total Price']}</p>
            <ul>
              {order['Order Items'].split(',').map((item, index) => (
                <li key={index}>{item.trim()}</li>
              ))}
            </ul>
            {!accepted.has(order.id) && (
              <button onClick={() => acceptOrder(order.id)} style={{ marginTop: '1rem', backgroundColor: '#28a745', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px' }}>
                ACCEPT
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
