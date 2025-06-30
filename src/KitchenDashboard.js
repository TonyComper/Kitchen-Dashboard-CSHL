import React, { useEffect, useState, useRef } from 'react';

export default function KitchenDashboard() {
  const [orders, setOrders] = useState([]);
  const [accepted, setAccepted] = useState(new Set(JSON.parse(localStorage.getItem('acceptedOrders') || '[]')));
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showAccepted, setShowAccepted] = useState(false); // state to toggle between accepted and pending orders
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

      // Check for new unseen messages (including blank Message_Reason)
      const newUnseenMessage = orderArray.find(order => (order['Order Type'] === 'MESSAGE'));
      if (newUnseenMessage) {
        messageAudio.current?.play(); // Play message audio alert
        triggerAlarm(newUnseenMessage.id, 'MESSAGE'); // Trigger alarm for MESSAGE orders
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [audioEnabled]);

  // Trigger alarm for new orders or messages
  const triggerAlarm = (orderId, orderType) => {
    console.log("Triggering alarm for order:", orderId); // Debugging: Check if the alarm is triggered
    if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    alarmIntervalRef.current = setInterval(() => {
      if (orderType === 'PICK UP' || orderType === 'DELIVERY') {
        if (!accepted.has(orderId)) {
          console.log("Playing alarm sound"); // Debugging: Check if the alarm sound is played
          alarmAudio.current.play();
        } else {
          clearInterval(alarmIntervalRef.current);
        }
      } else if (orderType === 'MESSAGE') {
        messageAudio.current.play(); // Play message audio for MESSAGE orders
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
  const todayStr = today.toISOString().split('T')[0]; // Get only the date part in YYYY-MM-DD format

  const displayedOrders = orders.filter(order => {
    const isInDateRange = order['Order Date'].split('T')[0] === todayStr; // Only show today's orders
    return isInDateRange;
  }).sort((a, b) => new Date(b['Order Date']) - new Date(a['Order Date']));

  return (
    <div style={{ padding: '1rem', fontFamily: 'Arial' }}>
      <h1>Orders and Messages - California Winston Churchill</h1>
      <p><strong>Date:</strong> {today.toLocaleDateString()}</p>

      <button onClick={() => setShowAccepted(prev => !prev)} style={{ marginRight: '1rem', backgroundColor: 'red', color: 'white', padding: '0.5rem 1rem' }}>
        {showAccepted ? 'Hide Accepted Orders' : 'View Accepted Orders'}
      </button>

      {/* Displaying messages */}
      {orders.filter(order => (order['Order Type'] || '').toUpperCase() === 'MESSAGE').map(msg => (
        <div key={msg.id} style={{ border: '2px solid #f00', backgroundColor: '#fffbcc', padding: '1rem', marginTop: '1rem', borderRadius: '8px' }}>
          <h3>Incoming Message</h3>
          <p><strong>Message Date:</strong> {msg['Message Date']}</p>
          <p><strong>Caller Name:</strong> {msg['Caller_Name']}</p>
          <p><strong>Phone:</strong> {msg['Caller_Phone']}</p>
          <p><strong>Reason:</strong> {msg['Message_Reason'] || 'No reason provided'}</p>
          
          {/* Show READ MESSAGE button for all incoming messages */}
          <button 
            onClick={() => {}}
            style={{ backgroundColor: 'red', color: 'white', marginRight: '1rem', padding: '0.5rem 1rem' }}
          >
            READ MESSAGE
          </button>
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
