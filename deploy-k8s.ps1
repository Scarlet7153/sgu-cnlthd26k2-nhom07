# PCShop Kubernetes Deployment Script (Backend Only)
# Usage: ./deploy-k8s.ps1

$backendServices = @(
    "eureka-service",
    "api-gateway",
    "auth-service",
    "user-service",
    "product-service",
    "order-service",
    "payment-service"
)

Write-Host "--- 1. Building Backend Docker Images ---" -ForegroundColor Cyan

foreach ($service in $backendServices) {
    Write-Host "Building Backend: ${service}..." -ForegroundColor Yellow
    docker build -t "pcshop/${service}:latest" "./backend/${service}"
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "ERROR: Build failed for ${service}" -ForegroundColor Red
        exit
    }
}

Write-Host "`n--- 2. Deploying Backend to Kubernetes ---" -ForegroundColor Cyan

kubectl apply -k ./backend/k8s

Write-Host "Refreshing Backend Pods..." -ForegroundColor Gray
kubectl rollout restart deployment -n pcshop

Write-Host "`n--- COMPLETED ---" -ForegroundColor Green
Write-Host "Wait 1-2 minutes then check with: kubectl get pods -n pcshop"
Write-Host "API Gateway (NodePort): http://localhost:30080"
Write-Host "Run FE locally: cd frontend; npm run dev"
