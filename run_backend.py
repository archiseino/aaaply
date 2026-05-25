import uvicorn
import os
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env file


if __name__ == "__main__":
    # Ensure the environment knows we are running locally
    print("Starting SobatApply Backend (Local Mode)...")
    print("Clipboard bridge is active (Windows Only).")
    
    # Run the app from api/index.py
    uvicorn.run("api.index:app", host="localhost", port=8000, reload=True)
