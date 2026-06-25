# Docker recipe to run the Synapse FastAPI backend on Hugging Face Spaces.
# The React frontend is deployed separately (Vercel); this image is the API only.
FROM python:3.12-slim

# Create the required non-root user (Hugging Face needs UID 1000)
RUN useradd -m -u 1000 user

# Install backend dependencies as root (so they land on the system PATH)
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Run as the non-root user with a writable home (SQLite DB + uploads live here)
USER user
ENV HOME=/home/user
WORKDIR /home/user/app

# Copy only the backend (frontend is excluded via .dockerignore)
COPY --chown=user backend/ .

ENV PORT=7860
EXPOSE 7860

# Serve the FastAPI app on Hugging Face's port
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
