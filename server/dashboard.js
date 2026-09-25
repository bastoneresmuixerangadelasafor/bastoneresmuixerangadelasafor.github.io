function getUserActivity_() {
  try {
    const user = Session.getActiveUser();
    const email = user.getEmail();
    
    if (!email) {
      return getDefaultActivity_();
    }
    
    // Get user-specific activity from storage
    const props = PropertiesService.getUserProperties();
    const activityKey = 'userActivity_' + email;
    const stored = props.getProperty(activityKey);
    
    if (stored) {
      const activities = JSON.parse(stored);
      // Return only recent activities (last 10)
      return activities.slice(0, 10);
    }
    
    // Return sample activity for new users
    return getDefaultActivity_();
    
  } catch (error) {
    console.log('Error getting activity: ' + error.toString());
    return getDefaultActivity_();
  }
}

function getDefaultActivity_() {
  const now = new Date();
  return [
    {
      icon: '✅',
      description: 'Welcome to the dashboard! Your account has been set up.',
      timestamp: now.toISOString()
    },
    {
      icon: '📊',
      description: 'Sample project created',
      timestamp: new Date(now - 3600000).toISOString() // 1 hour ago
    },
    {
      icon: '📝',
      description: 'First task added to your project',
      timestamp: new Date(now - 7200000).toISOString() // 2 hours ago
    }
  ];
}

function addActivity_(activity) {
  try {
    const user = Session.getActiveUser();
    const email = user.getEmail();
    
    if (!email) {
      throw new Error('User not authenticated');
    }
    
    const props = PropertiesService.getUserProperties();
    const activityKey = 'userActivity_' + email;
    
    let activities = [];
    const stored = props.getProperty(activityKey);
    if (stored) {
      activities = JSON.parse(stored);
    }
    
    // Add new activity at the beginning
    activities.unshift({
      ...activity,
      timestamp: activity.timestamp || new Date().toISOString()
    });
    
    // Keep only last 50 activities
    activities = activities.slice(0, 50);
    
    props.setProperty(activityKey, JSON.stringify(activities));
    
    return API.newResult_({ result: activities[0] });
  } catch (error) {
    console.log('Error adding activity: ' + error.toString());
    return API.newError_({ error: error.toString() });
  }
}

function clearActivity_() {
  try {
    const user = Session.getActiveUser();
    const email = user.getEmail();
    
    if (!email) {
      throw new Error('User not authenticated');
    }
    
    const props = PropertiesService.getUserProperties();
    const activityKey = 'userActivity_' + email;
    props.deleteProperty(activityKey);
    
    return API.newResult_({ result: { message: 'Activity cleared' } });
  } catch (error) {
    console.log('Error clearing activity: ' + error.toString());
    return API.newError_({ error: error.toString() });
  }
}
