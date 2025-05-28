from fastapi import FastAPI, UploadFile, File
import numpy as np
import cv2
from io import BytesIO
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
import logging
import pydicom
import io
from pydicom.tag import Tag

app = FastAPI()

# Configure logging
logging.basicConfig(level=logging.INFO)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace "*" with ["http://localhost:3000"] for security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def anonymize_dicom(ds):
    """Anonymize patient data in a DICOM dataset."""
    tags_to_anonymize = [
        (0x0010, 0x0010),  # PatientName
        (0x0010, 0x0020),  # PatientID
        (0x0010, 0x0030),  # PatientBirthDate
        (0x0010, 0x0040),  # PatientSex
        (0x0008, 0x0090),  # ReferringPhysicianName
        (0x0008, 0x0080),  # InstitutionName
        (0x0008, 0x1050),  # PerformingPhysicianName
        (0x0008, 0x1070),  # Operators' Name
    ]

    for tag in tags_to_anonymize:
        tag_obj = Tag(tag)
        if tag_obj in ds:
            ds[tag_obj].value = "Anonymized"

    return ds

def process_dicom_image(dicom_bytes):
    """Apply noise reduction and return a PNG image."""
    logging.info(f"Processing DICOM file of length: {len(dicom_bytes)}")

    # Load DICOM dataset
    dataset = pydicom.dcmread(BytesIO(dicom_bytes), force=True)

    # Anonymize the dataset
    dataset = anonymize_dicom(dataset)

    # Convert DICOM pixel data to NumPy array
    img = dataset.pixel_array.astype(np.float32)

    # Normalize to 8-bit range
    img = cv2.normalize(img, None, 0, 255, cv2.NORM_MINMAX)
    img = img.astype(np.uint8)

    # Apply bilateral filter (noise reduction)
    denoised = cv2.bilateralFilter(img, d=9, sigmaColor=75, sigmaSpace=75)

    # Convert filtered image to PNG format
    _, buffer = cv2.imencode(".bmp", denoised)

    return buffer.tobytes()  # Return PNG image bytes

@app.post("/process-dicom/")
async def process_dicom(file: UploadFile = File(...)):
    dicom_bytes = await file.read()
    try:
        processed_image = process_dicom_image(dicom_bytes)
        return Response(content=processed_image, media_type="image/bmp")
    except Exception as e:
        logging.error(f"Error processing DICOM: {e}")
        return Response(content=str(e), media_type="text/plain", status_code=400)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)