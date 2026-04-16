def get_maintenance_advice(predicted_class, confidence):
    """
    Generates technical maintenance advice based on damage type and confidence.
    Returns a dictionary with priority, action, and estimated urgency.
    """
    cls = (predicted_class or "").lower()
    
    # Base advice dictionary
    advice = {
        "priority": "Low",
        "action": "Routine inspection.",
        "urgency": "None",
        "severity_score": 1,
        "recommendation": "Maintain regular monitoring."
    }

    if "pothole" in cls:
        if confidence > 0.85:
            advice.update({
                "priority": "Critical",
                "action": "Immediate Patching / Filling",
                "urgency": "24-48 Hours",
                "severity_score": 9,
                "recommendation": "Apply hot-mix asphalt or high-performance cold-patch immediately to prevent vehicle damage."
            })
        else:
            advice.update({
                "priority": "High",
                "action": "Scheduled Filling",
                "urgency": "7 Days",
                "severity_score": 7,
                "recommendation": "Fill with standard asphalt mix. Monitor for expansion after rainy weather."
            })
            
    elif "crack" in cls:
        if confidence > 0.8:
            advice.update({
                "priority": "Medium",
                "action": "Crack Sealing / Routing",
                "urgency": "30 Days",
                "severity_score": 5,
                "recommendation": "Use rubberized asphalt sealant to prevent water infiltration and avoid pothole formation."
            })
        else:
            advice.update({
                "priority": "Low",
                "action": "Surface Treatment",
                "urgency": "90 Days",
                "severity_score": 3,
                "recommendation": "Apply fog seal or thin overlay during next scheduled maintenance cycle."
            })
            
    elif "damaged" in cls:
        advice.update({
            "priority": "Medium",
            "action": "Pavement Resurfacing",
            "urgency": "Seasonal",
            "severity_score": 6,
            "recommendation": "Assess for structural integrity. Consider milling and overlay if surface degradation persists."
        })
        
    elif "normal" in cls:
        advice.update({
            "priority": "None",
            "action": "Preservation",
            "urgency": "Annually",
            "severity_score": 0,
            "recommendation": "Perfect road condition. No immediate action required. Schedule routine annual survey."
        })

    return advice
