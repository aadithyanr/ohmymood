import logging
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
from dotenv import load_dotenv
from PIL import Image
import io
import numpy as np
from deepface import DeepFace

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PUSHOVER_API_KEY = os.getenv("PUSHOVER_API_KEY")
PUSHOVER_USER_KEY = os.getenv("PUSHOVER_USER_KEY")

FOOD_APIS = [
    "https://www.themealdb.com/api/json/v1/1/random.php" #was the first one i found, feel free to add any if y'all see
]

async def get_random_food_image():
    """Get a random food image URL"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(FOOD_APIS[0])
            response.raise_for_status()
            
            data = response.json()
            if "meals" in data and len(data["meals"]) > 0:
                return data["meals"][0]["strMealThumb"]
            
            logger.error(f"Unexpected API response format: {data}")
            return None
    except Exception as e:
        logger.error(f"Error fetching food image: {e}")
        return None

async def send_pushover_notification(image_url):
    """Send notification with food image via Pushover"""
    if not all([PUSHOVER_API_KEY, PUSHOVER_USER_KEY]):
        logger.error("Pushover credentials not configured")
        return False

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.pushover.net/1/messages.json",
                data={
                    "token": PUSHOVER_API_KEY,
                    "user": PUSHOVER_USER_KEY,
                    "message": "Here's some food to cheer you up! 🍕",
                    "title": "Food for Your Mood",
                    "url": image_url,
                    "url_title": "View Food Image"
                }
            )
            response.raise_for_status()
            return True
    except Exception as e:
        logger.error(f"Error sending Pushover notification: {e}")
        return False

@app.post("/analyze_emotion")
async def analyze_emotion(image: UploadFile = File(...)):
    """Analyze emotion in uploaded image using DeepFace"""
    try:
        contents = await image.read()
        img = Image.open(io.BytesIO(contents))
        img_array = np.array(img)
        
        result = DeepFace.analyze(
            img_array,
            actions=['emotion'],
            enforce_detection=False
        )
        
        emotions = result[0]['emotion']
        dominant_emotion = max(emotions.items(), key=lambda x: x[1])
        
        return {
            "emotion": dominant_emotion[0],
            "score": dominant_emotion[1] / 100
        }
    except Exception as e:
        logger.error(f"Error analyzing emotion: {e}")
        return {"emotion": "neutral", "score": 0.5}

@app.post("/send_food")
async def send_food():
    """Send food image when user is sad"""
    try:
        food_image_url = await get_random_food_image()
        if not food_image_url:
            raise HTTPException(status_code=503, detail="Could not get food image")
            
        success = await send_pushover_notification(food_image_url)
        if not success:
            raise HTTPException(status_code=503, detail="Could not send notification")
            
        return {"status": "success", "message": "Food image sent!"}
            
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error sending food: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)