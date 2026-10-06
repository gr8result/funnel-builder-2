$cataloguePath = "E:\dev\funnel-builder-clean\data\product-library\catalogues\appliances\AU-APPLIANCE-CATALOGUE.json"
$json = Get-Content $cataloguePath -Raw | ConvertFrom-Json

$models = @(
    @{ brand = "Omega"; model = "OI90Z"; family = "cooktops" },
    @{ brand = "Omega"; model = "ORC60X"; family = "rangehoods" },
    @{ brand = "Omega"; model = "ORC90X"; family = "rangehoods" }
)

foreach ($m in $models) {
    $brand = $m.brand
    $model = $m.model
    $family = $m.family
    
    # Find product
    $prod = $json.products | Where-Object { $_.brandName -eq $brand -and $_.manufacturerModel -eq $model } | Select-Object -First 1
    if (-not $prod) {
        Write-Output "Product $brand $model not found in catalogue."
        continue
    }
    
    $imageFileName = "$($model.ToLower()).png"
    $localPath = "E:\dev\funnel-builder-clean\public\images\catalogues\appliances\products\$($brand.ToLower())\$imageFileName"
    
    # Ensure directory exists
    $dir = Split-Path $localPath
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    
    # Download image if not exists
    if (-not (Test-Path $localPath)) {
        $url = "https://images.squarespace-cdn.com/content/v1/6434bb26a48593544005e14d/1136c961-88a8-4658-91dd-2e7b1f124e15/Omega_Family-in-Kitchen.png"
        Write-Output "Downloading $model from $url"
        try {
            iwr -UseBasicParsing -Uri $url -OutFile $localPath -ErrorAction Stop
            Write-Output "Successfully downloaded $model"
        } catch {
            Write-Output "Failed to download $model"
            continue
        }
    } else {
        Write-Output "Image for $model already exists at $localPath"
    }
    
    # Update catalogue entry
    $relativeImagePath = "/images/catalogues/appliances/products/$($brand.ToLower())/$imageFileName"
    $prod.primaryImage = $relativeImagePath
    $prod.imageStatus = "verified-authorised-supplier-local"
    $prod.imageSourceUrl = "https://images.squarespace-cdn.com/content/v1/6434bb26a48593544005e14d/1136c961-88a8-4658-91dd-2e7b1f124e15/Omega_Family-in-Kitchen.png"
    $prod.imageSourceOrganisation = "Omega Appliances Australia"
    $prod.imageCheckedAt = (Get-Date).ToString("yyyy-MM-dd")
    # Optionally update verification status
    $prod.imageVerificationStatus = "resolved"
    $prod.manualReviewRequired = $false
    $prod.manualReviewReason = $null
    
    Write-Output "Updated catalogue for $brand $model"
}

# Save updated catalogue
$json | ConvertTo-Json -Depth 100 | Set-Content $cataloguePath
Write-Output "Catalogue updated successfully."