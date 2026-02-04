function getDashboardStats_() {
  try {
    const user = Session.getActiveUser();
    const email = user.getEmail();
    
    if (!email) {
      return getDefaultStats_();
    }
    
    // Get user-specific stats from storage
    const props = PropertiesService.getUserProperties();
    const statsKey = 'userStats_' + email;
    const stored = props.getProperty(statsKey);
    
    if (stored) {
      return JSON.parse(stored);
    }
    
    // Return default stats for new users
    const defaultStats = getDefaultStats_();
    props.setProperty(statsKey, JSON.stringify(defaultStats));
    return defaultStats;
    
  } catch (error) {
    console.log('Error getting dashboard stats: ' + error.toString());
    return getDefaultStats_();
  }
}

function getDefaultStats_() {
  return {
    success: true,
    result: {
      projects: 3,
      tasks: 12,
      completed: 8,
      pending: 4,
    },
  };
}

function updateDashboardStats_(stats) {
  try {
    const user = Session.getActiveUser();
    const email = user.getEmail();
    
    if (!email) {
      throw new Error('User not authenticated');
    }
    
    const props = PropertiesService.getUserProperties();
    const statsKey = 'userStats_' + email;
    
    const currentStats = getDashboardStats_();
    const updatedStats = { ...currentStats, ...stats };
    
    props.setProperty(statsKey, JSON.stringify(updatedStats));
    
    return {
      success: true,
      result: updatedStats
    };
  } catch (error) {
    console.log('Error updating stats: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

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
    
    return {
      success: true,
      result: activities[0]
    };
  } catch (error) {
    console.log('Error adding activity: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
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
    
    return {
      success: true,
      result: { message: 'Activity cleared' },
    };
  } catch (error) {
    console.log('Error clearing activity: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}
