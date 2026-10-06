$url = 'https://www.harveynormancommercial.com.au/kitchen';
$r = Invoke-WebRequest -Uri $url -UseBasicParsing;
$links = $r.Links | Where-Object { $_.href -match 'brand=\d+' } | Select-Object -Expand href -Unique;
$links