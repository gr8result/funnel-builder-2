$cataloguePath = "E:\dev\funnel-builder-clean\data\product-library\catalogues\appliances\AU-APPLIANCE-CATALOGUE.json"
$json = Get-Content $cataloguePath -Raw | ConvertFrom-Json

# List of missing models from gap report (brand, model)
$missingModels = @(
    @{ brand = "Euromaid"; model = "ECCK900"; family = "cooktops" },
    @{ brand = "Euromaid"; model = "GC90S"; family = "cooktops" },
    @{ brand = "Euromaid"; model = "EDW14S"; family = "dishwashers" },
    @{ brand = "Euromaid"; model = "CS60S"; family = "rangehoods" },
    @{ brand = "Euromaid"; model = "FS90S"; family = "rangehoods" },
    @{ brand = "Westinghouse"; model = "WRI930SB"; family = "rangehoods" }
)

foreach ($m in $missingModels) {
    $brand = $m.brand
    $model = $m.model
    $family = $m.family
    
    # Find product
    $prod = $json.products | Where-Object { $_.brandName -eq $brand -and $_.manufacturerModel -eq $model } | Select-Object -First 1
    if (-not $prod) {
        Write-Output "Product $brand $model not found in catalogue."
        continue
    }
    
    # Construct possible image URL from HNC backend
    $brandLower = $brand.ToLower()
    $modelStr = $model.ToString()
    if ($modelStr.Length -ge 2) {
        $firstChar = $modelStr.Substring(0,1)
        $secondChar = $modelStr.Substring(0,2)
    } else {
        Write-Output "Model $model too short to construct URL."
        continue
    }
    $url = "https://backend.harveynormancommercial.com.au/media/catalog/product/$firstChar/$secondChar/${modelStr}_${brandLower}_web.jpg"
    Write-Output ("Checking URL for {0} {1}: {2}" -f $brand, $model, $url)
    
    # Check if URL exists (HEAD request)
    try {
        $response = iwr -UseBasicParsing -Method Head -Uri $url -ErrorAction Stop -TimeoutSec 10
        if ($response.StatusCode -ne 200) {
            Write-Output ("URL returned status {0}. Skipping." -f $response.StatusCode)
            continue
        }
    } catch {
        Write-Output "Failed to access URL: $($_.Exception.Message)"
        continue
    }
    
    # URL exists, now download image if not already present locally
    $imageFileName = ($modelStr.ToLower()) + ".jpg"
    $localDir = "E:\dev\funnel-builder-clean\public\images\catalogues\appliances\products\$brandLower"
    $localPath = Join-Path $localDir $imageFileName
    
    # Ensure directory exists
    if (-not (Test-Path $localDir)) {
        New-Item -ItemType Directory -Path $localDir -Force | Out-Null
    }
    
    if (-not (Test-Path $localPath)) {
        Write-Output ("Downloading image for {0}" -f $model)
        try {
            iwr -UseBasicParsing -Uri $url -OutFile $localPath -ErrorAction Stop
            Write-Output ("Successfully downloaded image for {0}" -f $model)
        } catch {
            Write-Output ("Failed to download image: {0}" -f $_.Exception.Message)
            continue
        }
    } else {
        Write-Output ("Image already exists at {0}" -f $localPath)
    }
    
    # Update catalogue entry
    $relativeImagePath = "/images/catalogues/appliances/products/$brandLower/$imageFileName"
    $prod.primaryImage = $relativeImagePath
    $prod.imageStatus = "verified-authorised-supplier-local"
    $prod.imageSourceUrl = $url
    $prod.imageSourceOrganisation = "Harvey Norman Commercial"
    $prod.imageCheckedAt = (Get-Date).ToString("yyyy-MM-dd")
    # Update verification status
    $prod.imageVerificationStatus = "resolved"
    $prod.manualReviewRequired = $false
    $prod.manualReviewReason = $null
    
    Write-Output ("Updated catalogue for {0} {1}" -f $brand, $model)
}

# Save updated catalogue
$json | ConvertTo-Json -Depth 100 | Set-Content $cataloguePath
Write-Output "Catalogue updated successfully."