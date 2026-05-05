import { useState, useRef, useEffect, useCallback } from 'react'

// S&P 500 constituents (approximate current composition)
const SP500_TICKERS = [
  { symbol: 'MMM',   name: '3M Company' },
  { symbol: 'AOS',   name: 'A.O. Smith Corp' },
  { symbol: 'ABT',   name: 'Abbott Laboratories' },
  { symbol: 'ABBV',  name: 'AbbVie Inc.' },
  { symbol: 'ACN',   name: 'Accenture plc' },
  { symbol: 'ADBE',  name: 'Adobe Inc.' },
  { symbol: 'AMD',   name: 'Advanced Micro Devices' },
  { symbol: 'AES',   name: 'AES Corporation' },
  { symbol: 'AFL',   name: 'Aflac Inc.' },
  { symbol: 'A',     name: 'Agilent Technologies' },
  { symbol: 'APD',   name: 'Air Products and Chemicals' },
  { symbol: 'ABNB',  name: 'Airbnb Inc.' },
  { symbol: 'AKAM',  name: 'Akamai Technologies' },
  { symbol: 'ALK',   name: 'Alaska Air Group' },
  { symbol: 'ALB',   name: 'Albemarle Corporation' },
  { symbol: 'ARE',   name: 'Alexandria Real Estate Equities' },
  { symbol: 'ALGN',  name: 'Align Technology' },
  { symbol: 'ALLE',  name: 'Allegion plc' },
  { symbol: 'LNT',   name: 'Alliant Energy' },
  { symbol: 'ALL',   name: 'Allstate Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. (Class A)' },
  { symbol: 'GOOG',  name: 'Alphabet Inc. (Class C)' },
  { symbol: 'MO',    name: 'Altria Group' },
  { symbol: 'AMZN',  name: 'Amazon.com Inc.' },
  { symbol: 'AMCR',  name: 'Amcor plc' },
  { symbol: 'AEE',   name: 'Ameren Corporation' },
  { symbol: 'AAL',   name: 'American Airlines Group' },
  { symbol: 'AEP',   name: 'American Electric Power' },
  { symbol: 'AXP',   name: 'American Express' },
  { symbol: 'AIG',   name: 'American International Group' },
  { symbol: 'AMT',   name: 'American Tower Corp' },
  { symbol: 'AWK',   name: 'American Water Works' },
  { symbol: 'AMP',   name: 'Ameriprise Financial' },
  { symbol: 'AME',   name: 'AMETEK Inc.' },
  { symbol: 'AMGN',  name: 'Amgen Inc.' },
  { symbol: 'APH',   name: 'Amphenol Corporation' },
  { symbol: 'ADI',   name: 'Analog Devices' },
  { symbol: 'ANSS',  name: 'ANSYS Inc.' },
  { symbol: 'AON',   name: 'Aon plc' },
  { symbol: 'APA',   name: 'APA Corporation' },
  { symbol: 'AAPL',  name: 'Apple Inc.' },
  { symbol: 'AMAT',  name: 'Applied Materials' },
  { symbol: 'APTV',  name: 'Aptiv plc' },
  { symbol: 'ACGL',  name: 'Arch Capital Group' },
  { symbol: 'ADM',   name: 'Archer-Daniels-Midland' },
  { symbol: 'ANET',  name: 'Arista Networks' },
  { symbol: 'AJG',   name: 'Arthur J. Gallagher & Co.' },
  { symbol: 'AIZ',   name: 'Assurant Inc.' },
  { symbol: 'T',     name: 'AT&T Inc.' },
  { symbol: 'ATO',   name: 'Atmos Energy' },
  { symbol: 'ADSK',  name: 'Autodesk Inc.' },
  { symbol: 'ADP',   name: 'Automatic Data Processing' },
  { symbol: 'AZO',   name: 'AutoZone Inc.' },
  { symbol: 'AVB',   name: 'AvalonBay Communities' },
  { symbol: 'AVY',   name: 'Avery Dennison' },
  { symbol: 'AXON',  name: 'Axon Enterprise' },
  { symbol: 'BKR',   name: 'Baker Hughes' },
  { symbol: 'BALL',  name: 'Ball Corporation' },
  { symbol: 'BAC',   name: 'Bank of America Corp.' },
  { symbol: 'BBWI',  name: 'Bath & Body Works' },
  { symbol: 'BAX',   name: 'Baxter International' },
  { symbol: 'BDX',   name: 'Becton Dickinson' },
  { symbol: 'BRK-B', name: 'Berkshire Hathaway (Class B)' },
  { symbol: 'BBY',   name: 'Best Buy Co.' },
  { symbol: 'BIIB',  name: 'Biogen Inc.' },
  { symbol: 'BLK',   name: 'BlackRock Inc.' },
  { symbol: 'BX',    name: 'Blackstone Inc.' },
  { symbol: 'BK',    name: 'BNY Mellon' },
  { symbol: 'BA',    name: 'Boeing Company' },
  { symbol: 'BKNG',  name: 'Booking Holdings' },
  { symbol: 'BWA',   name: 'BorgWarner Inc.' },
  { symbol: 'BSX',   name: 'Boston Scientific' },
  { symbol: 'BMY',   name: 'Bristol-Myers Squibb' },
  { symbol: 'AVGO',  name: 'Broadcom Inc.' },
  { symbol: 'BR',    name: 'Broadridge Financial Solutions' },
  { symbol: 'BRO',   name: 'Brown & Brown' },
  { symbol: 'BF-B',  name: 'Brown-Forman (Class B)' },
  { symbol: 'BLDR',  name: 'Builders FirstSource' },
  { symbol: 'BG',    name: 'Bunge Global SA' },
  { symbol: 'CHRW',  name: 'C.H. Robinson Worldwide' },
  { symbol: 'CDNS',  name: 'Cadence Design Systems' },
  { symbol: 'CZR',   name: 'Caesars Entertainment' },
  { symbol: 'CPT',   name: 'Camden Property Trust' },
  { symbol: 'CPB',   name: 'Campbell Soup Company' },
  { symbol: 'COF',   name: 'Capital One Financial' },
  { symbol: 'CAH',   name: 'Cardinal Health' },
  { symbol: 'KMX',   name: 'CarMax Inc.' },
  { symbol: 'CCL',   name: 'Carnival Corporation' },
  { symbol: 'CARR',  name: 'Carrier Global' },
  { symbol: 'CAT',   name: 'Caterpillar Inc.' },
  { symbol: 'CBOE',  name: 'Cboe Global Markets' },
  { symbol: 'CBRE',  name: 'CBRE Group' },
  { symbol: 'CDW',   name: 'CDW Corporation' },
  { symbol: 'CE',    name: 'Celanese Corporation' },
  { symbol: 'COR',   name: 'Cencora Inc.' },
  { symbol: 'CNC',   name: 'Centene Corporation' },
  { symbol: 'CNP',   name: 'CenterPoint Energy' },
  { symbol: 'CF',    name: 'CF Industries' },
  { symbol: 'CRL',   name: 'Charles River Laboratories' },
  { symbol: 'SCHW',  name: 'Charles Schwab' },
  { symbol: 'CHTR',  name: 'Charter Communications' },
  { symbol: 'CVX',   name: 'Chevron Corporation' },
  { symbol: 'CMG',   name: 'Chipotle Mexican Grill' },
  { symbol: 'CB',    name: 'Chubb Limited' },
  { symbol: 'CHD',   name: 'Church & Dwight' },
  { symbol: 'CI',    name: 'Cigna Group' },
  { symbol: 'CINF',  name: 'Cincinnati Financial' },
  { symbol: 'CTAS',  name: 'Cintas Corporation' },
  { symbol: 'CSCO',  name: 'Cisco Systems' },
  { symbol: 'C',     name: 'Citigroup Inc.' },
  { symbol: 'CFG',   name: 'Citizens Financial Group' },
  { symbol: 'CLX',   name: 'Clorox Company' },
  { symbol: 'CME',   name: 'CME Group' },
  { symbol: 'CMS',   name: 'CMS Energy' },
  { symbol: 'KO',    name: 'Coca-Cola Company' },
  { symbol: 'CTSH',  name: 'Cognizant Technology Solutions' },
  { symbol: 'CL',    name: 'Colgate-Palmolive' },
  { symbol: 'CMCSA', name: 'Comcast Corporation' },
  { symbol: 'CAG',   name: 'Conagra Brands' },
  { symbol: 'COP',   name: 'ConocoPhillips' },
  { symbol: 'ED',    name: 'Consolidated Edison' },
  { symbol: 'STZ',   name: 'Constellation Brands' },
  { symbol: 'CEG',   name: 'Constellation Energy' },
  { symbol: 'COO',   name: 'Cooper Companies' },
  { symbol: 'CPRT',  name: 'Copart Inc.' },
  { symbol: 'GLW',   name: 'Corning Inc.' },
  { symbol: 'CPAY',  name: 'Corpay Inc.' },
  { symbol: 'CTVA',  name: 'Corteva Inc.' },
  { symbol: 'CSGP',  name: 'CoStar Group' },
  { symbol: 'COST',  name: 'Costco Wholesale' },
  { symbol: 'CTRA',  name: 'Coterra Energy' },
  { symbol: 'CRWD',  name: 'CrowdStrike Holdings' },
  { symbol: 'CCI',   name: 'Crown Castle Inc.' },
  { symbol: 'CSX',   name: 'CSX Corporation' },
  { symbol: 'CMI',   name: 'Cummins Inc.' },
  { symbol: 'CVS',   name: 'CVS Health' },
  { symbol: 'DHR',   name: 'Danaher Corporation' },
  { symbol: 'DRI',   name: 'Darden Restaurants' },
  { symbol: 'DVA',   name: 'DaVita Inc.' },
  { symbol: 'DECK',  name: 'Deckers Outdoor' },
  { symbol: 'DE',    name: 'Deere & Company' },
  { symbol: 'DAL',   name: 'Delta Air Lines' },
  { symbol: 'DVN',   name: 'Devon Energy' },
  { symbol: 'DXCM',  name: 'Dexcom Inc.' },
  { symbol: 'FANG',  name: 'Diamondback Energy' },
  { symbol: 'DLR',   name: 'Digital Realty Trust' },
  { symbol: 'DFS',   name: 'Discover Financial Services' },
  { symbol: 'DG',    name: 'Dollar General' },
  { symbol: 'DLTR',  name: 'Dollar Tree' },
  { symbol: 'D',     name: 'Dominion Energy' },
  { symbol: 'DPZ',   name: "Domino's Pizza" },
  { symbol: 'DOV',   name: 'Dover Corporation' },
  { symbol: 'DOW',   name: 'Dow Inc.' },
  { symbol: 'DHI',   name: 'D.R. Horton' },
  { symbol: 'DTE',   name: 'DTE Energy' },
  { symbol: 'DUK',   name: 'Duke Energy' },
  { symbol: 'DD',    name: 'DuPont de Nemours' },
  { symbol: 'EMN',   name: 'Eastman Chemical' },
  { symbol: 'ETN',   name: 'Eaton Corporation' },
  { symbol: 'EBAY',  name: 'eBay Inc.' },
  { symbol: 'ECL',   name: 'Ecolab Inc.' },
  { symbol: 'EIX',   name: 'Edison International' },
  { symbol: 'EW',    name: 'Edwards Lifesciences' },
  { symbol: 'EA',    name: 'Electronic Arts' },
  { symbol: 'ELV',   name: 'Elevance Health' },
  { symbol: 'LLY',   name: 'Eli Lilly and Company' },
  { symbol: 'EMR',   name: 'Emerson Electric' },
  { symbol: 'ENPH',  name: 'Enphase Energy' },
  { symbol: 'ETR',   name: 'Entergy Corporation' },
  { symbol: 'EOG',   name: 'EOG Resources' },
  { symbol: 'EPAM',  name: 'EPAM Systems' },
  { symbol: 'EQT',   name: 'EQT Corporation' },
  { symbol: 'EFX',   name: 'Equifax Inc.' },
  { symbol: 'EQIX',  name: 'Equinix Inc.' },
  { symbol: 'EQR',   name: 'Equity Residential' },
  { symbol: 'ESS',   name: 'Essex Property Trust' },
  { symbol: 'EL',    name: 'Estee Lauder' },
  { symbol: 'ETSY',  name: 'Etsy Inc.' },
  { symbol: 'EG',    name: 'Everest Group' },
  { symbol: 'EVRG',  name: 'Evergy Inc.' },
  { symbol: 'ES',    name: 'Eversource Energy' },
  { symbol: 'EXC',   name: 'Exelon Corporation' },
  { symbol: 'EXPE',  name: 'Expedia Group' },
  { symbol: 'EXPD',  name: 'Expeditors International' },
  { symbol: 'EXR',   name: 'Extra Space Storage' },
  { symbol: 'XOM',   name: 'Exxon Mobil Corporation' },
  { symbol: 'FFIV',  name: 'F5 Inc.' },
  { symbol: 'FDS',   name: 'FactSet Research Systems' },
  { symbol: 'FICO',  name: 'Fair Isaac Corporation' },
  { symbol: 'FAST',  name: 'Fastenal Company' },
  { symbol: 'FRT',   name: 'Federal Realty Investment Trust' },
  { symbol: 'FDX',   name: 'FedEx Corporation' },
  { symbol: 'FIS',   name: 'Fidelity National Information Services' },
  { symbol: 'FITB',  name: 'Fifth Third Bancorp' },
  { symbol: 'FSLR',  name: 'First Solar' },
  { symbol: 'FE',    name: 'FirstEnergy Corp' },
  { symbol: 'FI',    name: 'Fiserv Inc.' },
  { symbol: 'FMC',   name: 'FMC Corporation' },
  { symbol: 'F',     name: 'Ford Motor Company' },
  { symbol: 'FTNT',  name: 'Fortinet Inc.' },
  { symbol: 'FTV',   name: 'Fortive Corporation' },
  { symbol: 'FOXA',  name: 'Fox Corporation (Class A)' },
  { symbol: 'FOX',   name: 'Fox Corporation (Class B)' },
  { symbol: 'BEN',   name: 'Franklin Resources' },
  { symbol: 'FCX',   name: 'Freeport-McMoRan' },
  { symbol: 'GRMN',  name: 'Garmin Ltd.' },
  { symbol: 'IT',    name: 'Gartner Inc.' },
  { symbol: 'GE',    name: 'GE Aerospace' },
  { symbol: 'GEHC',  name: 'GE HealthCare Technologies' },
  { symbol: 'GEV',   name: 'GE Vernova' },
  { symbol: 'GEN',   name: 'Gen Digital' },
  { symbol: 'GNRC',  name: 'Generac Holdings' },
  { symbol: 'GD',    name: 'General Dynamics' },
  { symbol: 'GIS',   name: 'General Mills' },
  { symbol: 'GM',    name: 'General Motors' },
  { symbol: 'GPC',   name: 'Genuine Parts Company' },
  { symbol: 'GILD',  name: 'Gilead Sciences' },
  { symbol: 'GPN',   name: 'Global Payments' },
  { symbol: 'GL',    name: 'Globe Life' },
  { symbol: 'GDDY',  name: 'GoDaddy Inc.' },
  { symbol: 'GS',    name: 'Goldman Sachs Group' },
  { symbol: 'HAL',   name: 'Halliburton Company' },
  { symbol: 'HIG',   name: 'Hartford Financial Services' },
  { symbol: 'HAS',   name: 'Hasbro Inc.' },
  { symbol: 'HCA',   name: 'HCA Healthcare' },
  { symbol: 'DOC',   name: 'Healthpeak Properties' },
  { symbol: 'HSIC',  name: 'Henry Schein' },
  { symbol: 'HSY',   name: 'Hershey Company' },
  { symbol: 'HES',   name: 'Hess Corporation' },
  { symbol: 'HPE',   name: 'Hewlett Packard Enterprise' },
  { symbol: 'HLT',   name: 'Hilton Worldwide' },
  { symbol: 'HOLX',  name: 'Hologic Inc.' },
  { symbol: 'HD',    name: 'Home Depot Inc.' },
  { symbol: 'HON',   name: 'Honeywell International' },
  { symbol: 'HRL',   name: 'Hormel Foods' },
  { symbol: 'HST',   name: 'Host Hotels & Resorts' },
  { symbol: 'HWM',   name: 'Howmet Aerospace' },
  { symbol: 'HPQ',   name: 'HP Inc.' },
  { symbol: 'HUBB',  name: 'Hubbell Inc.' },
  { symbol: 'HUM',   name: 'Humana Inc.' },
  { symbol: 'HBAN',  name: 'Huntington Bancshares' },
  { symbol: 'HII',   name: 'Huntington Ingalls Industries' },
  { symbol: 'IBM',   name: 'IBM Corporation' },
  { symbol: 'IEX',   name: 'IDEX Corporation' },
  { symbol: 'IDXX',  name: 'IDEXX Laboratories' },
  { symbol: 'ITW',   name: 'Illinois Tool Works' },
  { symbol: 'INCY',  name: 'Incyte Corporation' },
  { symbol: 'IR',    name: 'Ingersoll Rand' },
  { symbol: 'PODD',  name: 'Insulet Corporation' },
  { symbol: 'INTC',  name: 'Intel Corporation' },
  { symbol: 'ICE',   name: 'Intercontinental Exchange' },
  { symbol: 'IFF',   name: 'International Flavors & Fragrances' },
  { symbol: 'IP',    name: 'International Paper' },
  { symbol: 'IPG',   name: 'Interpublic Group' },
  { symbol: 'INTU',  name: 'Intuit Inc.' },
  { symbol: 'ISRG',  name: 'Intuitive Surgical' },
  { symbol: 'IVZ',   name: 'Invesco Ltd.' },
  { symbol: 'INVH',  name: 'Invitation Homes' },
  { symbol: 'IQV',   name: 'IQVIA Holdings' },
  { symbol: 'IRM',   name: 'Iron Mountain' },
  { symbol: 'JBHT',  name: 'J.B. Hunt Transport Services' },
  { symbol: 'JBL',   name: 'Jabil Inc.' },
  { symbol: 'JKHY',  name: 'Jack Henry & Associates' },
  { symbol: 'J',     name: 'Jacobs Solutions' },
  { symbol: 'JNJ',   name: 'Johnson & Johnson' },
  { symbol: 'JCI',   name: 'Johnson Controls' },
  { symbol: 'JPM',   name: 'JPMorgan Chase & Co.' },
  { symbol: 'K',     name: 'Kellanova' },
  { symbol: 'KDP',   name: 'Keurig Dr Pepper' },
  { symbol: 'KEY',   name: 'KeyCorp' },
  { symbol: 'KEYS',  name: 'Keysight Technologies' },
  { symbol: 'KMB',   name: 'Kimberly-Clark' },
  { symbol: 'KIM',   name: 'Kimco Realty' },
  { symbol: 'KMI',   name: 'Kinder Morgan' },
  { symbol: 'KLAC',  name: 'KLA Corporation' },
  { symbol: 'KHC',   name: 'Kraft Heinz' },
  { symbol: 'KR',    name: 'Kroger Co.' },
  { symbol: 'LHX',   name: 'L3Harris Technologies' },
  { symbol: 'LH',    name: 'Laboratory Corporation' },
  { symbol: 'LRCX',  name: 'Lam Research' },
  { symbol: 'LW',    name: 'Lamb Weston Holdings' },
  { symbol: 'LVS',   name: 'Las Vegas Sands' },
  { symbol: 'LDOS',  name: 'Leidos Holdings' },
  { symbol: 'LEN',   name: 'Lennar Corporation' },
  { symbol: 'LII',   name: 'Lennox International' },
  { symbol: 'LIN',   name: 'Linde plc' },
  { symbol: 'LYV',   name: 'Live Nation Entertainment' },
  { symbol: 'LKQ',   name: 'LKQ Corporation' },
  { symbol: 'LMT',   name: 'Lockheed Martin' },
  { symbol: 'L',     name: 'Loews Corporation' },
  { symbol: 'LOW',   name: "Lowe's Companies" },
  { symbol: 'LULU',  name: 'Lululemon Athletica' },
  { symbol: 'LYB',   name: 'LyondellBasell Industries' },
  { symbol: 'MTB',   name: 'M&T Bank' },
  { symbol: 'MRO',   name: 'Marathon Oil' },
  { symbol: 'MPC',   name: 'Marathon Petroleum' },
  { symbol: 'MKTX',  name: 'MarketAxess Holdings' },
  { symbol: 'MAR',   name: 'Marriott International' },
  { symbol: 'MMC',   name: 'Marsh & McLennan' },
  { symbol: 'MLM',   name: 'Martin Marietta Materials' },
  { symbol: 'MAS',   name: 'Masco Corporation' },
  { symbol: 'MA',    name: 'Mastercard Inc.' },
  { symbol: 'MTCH',  name: 'Match Group' },
  { symbol: 'MKC',   name: 'McCormick & Company' },
  { symbol: 'MCD',   name: "McDonald's Corporation" },
  { symbol: 'MCK',   name: 'McKesson Corporation' },
  { symbol: 'MDT',   name: 'Medtronic plc' },
  { symbol: 'MRK',   name: 'Merck & Co.' },
  { symbol: 'META',  name: 'Meta Platforms Inc.' },
  { symbol: 'MET',   name: 'MetLife Inc.' },
  { symbol: 'MTD',   name: 'Mettler-Toledo International' },
  { symbol: 'MGM',   name: 'MGM Resorts International' },
  { symbol: 'MCHP',  name: 'Microchip Technology' },
  { symbol: 'MU',    name: 'Micron Technology' },
  { symbol: 'MSFT',  name: 'Microsoft Corporation' },
  { symbol: 'MAA',   name: 'Mid-America Apartment Communities' },
  { symbol: 'MRNA',  name: 'Moderna Inc.' },
  { symbol: 'MHK',   name: 'Mohawk Industries' },
  { symbol: 'MOH',   name: 'Molina Healthcare' },
  { symbol: 'TAP',   name: 'Molson Coors Beverage' },
  { symbol: 'MDLZ',  name: 'Mondelez International' },
  { symbol: 'MPWR',  name: 'Monolithic Power Systems' },
  { symbol: 'MNST',  name: 'Monster Beverage' },
  { symbol: 'MCO',   name: "Moody's Corporation" },
  { symbol: 'MS',    name: 'Morgan Stanley' },
  { symbol: 'MOS',   name: 'Mosaic Company' },
  { symbol: 'MSI',   name: 'Motorola Solutions' },
  { symbol: 'MSCI',  name: 'MSCI Inc.' },
  { symbol: 'NDAQ',  name: 'Nasdaq Inc.' },
  { symbol: 'NTAP',  name: 'NetApp Inc.' },
  { symbol: 'NFLX',  name: 'Netflix Inc.' },
  { symbol: 'NEM',   name: 'Newmont Corporation' },
  { symbol: 'NWSA',  name: 'News Corp (Class A)' },
  { symbol: 'NWS',   name: 'News Corp (Class B)' },
  { symbol: 'NEE',   name: 'NextEra Energy' },
  { symbol: 'NKE',   name: 'Nike Inc.' },
  { symbol: 'NI',    name: 'NiSource Inc.' },
  { symbol: 'NDSN',  name: 'Nordson Corporation' },
  { symbol: 'NSC',   name: 'Norfolk Southern' },
  { symbol: 'NTRS',  name: 'Northern Trust' },
  { symbol: 'NOC',   name: 'Northrop Grumman' },
  { symbol: 'NCLH',  name: 'Norwegian Cruise Line Holdings' },
  { symbol: 'NRG',   name: 'NRG Energy' },
  { symbol: 'NUE',   name: 'Nucor Corporation' },
  { symbol: 'NVR',   name: 'NVR Inc.' },
  { symbol: 'NVDA',  name: 'NVIDIA Corporation' },
  { symbol: 'NWL',   name: 'Newell Brands' },
  { symbol: 'NXPI',  name: 'NXP Semiconductors' },
  { symbol: 'ORLY',  name: "O'Reilly Automotive" },
  { symbol: 'OXY',   name: 'Occidental Petroleum' },
  { symbol: 'ODFL',  name: 'Old Dominion Freight Line' },
  { symbol: 'OMC',   name: 'Omnicom Group' },
  { symbol: 'ON',    name: 'ON Semiconductor' },
  { symbol: 'OKE',   name: 'ONEOK Inc.' },
  { symbol: 'ORCL',  name: 'Oracle Corporation' },
  { symbol: 'OTIS',  name: 'Otis Worldwide' },
  { symbol: 'OC',    name: 'Owens Corning' },
  { symbol: 'OGN',   name: 'Organon & Co.' },
  { symbol: 'PKG',   name: 'Packaging Corp of America' },
  { symbol: 'PANW',  name: 'Palo Alto Networks' },
  { symbol: 'PARA',  name: 'Paramount Global' },
  { symbol: 'PH',    name: 'Parker-Hannifin' },
  { symbol: 'PAYX',  name: 'Paychex Inc.' },
  { symbol: 'PAYC',  name: 'Paycom Software' },
  { symbol: 'PYPL',  name: 'PayPal Holdings' },
  { symbol: 'PNR',   name: 'Pentair plc' },
  { symbol: 'PEP',   name: 'PepsiCo Inc.' },
  { symbol: 'PFE',   name: 'Pfizer Inc.' },
  { symbol: 'PCG',   name: 'PG&E Corporation' },
  { symbol: 'PM',    name: 'Philip Morris International' },
  { symbol: 'PSX',   name: 'Phillips 66' },
  { symbol: 'PNW',   name: 'Pinnacle West Capital' },
  { symbol: 'PNC',   name: 'PNC Financial Services' },
  { symbol: 'POOL',  name: 'Pool Corporation' },
  { symbol: 'PPG',   name: 'PPG Industries' },
  { symbol: 'PPL',   name: 'PPL Corporation' },
  { symbol: 'PFG',   name: 'Principal Financial Group' },
  { symbol: 'PG',    name: 'Procter & Gamble' },
  { symbol: 'PGR',   name: 'Progressive Corporation' },
  { symbol: 'PLD',   name: 'Prologis Inc.' },
  { symbol: 'PRU',   name: 'Prudential Financial' },
  { symbol: 'PEG',   name: 'Public Service Enterprise Group' },
  { symbol: 'PSA',   name: 'Public Storage' },
  { symbol: 'PHM',   name: 'PulteGroup Inc.' },
  { symbol: 'QCOM',  name: 'Qualcomm Inc.' },
  { symbol: 'PWR',   name: 'Quanta Services' },
  { symbol: 'DGX',   name: 'Quest Diagnostics' },
  { symbol: 'RL',    name: 'Ralph Lauren' },
  { symbol: 'RJF',   name: 'Raymond James Financial' },
  { symbol: 'RTX',   name: 'RTX Corporation' },
  { symbol: 'O',     name: 'Realty Income' },
  { symbol: 'REG',   name: 'Regency Centers' },
  { symbol: 'REGN',  name: 'Regeneron Pharmaceuticals' },
  { symbol: 'RF',    name: 'Regions Financial' },
  { symbol: 'RSG',   name: 'Republic Services' },
  { symbol: 'RMD',   name: 'ResMed Inc.' },
  { symbol: 'RVTY',  name: 'Revvity Inc.' },
  { symbol: 'ROK',   name: 'Rockwell Automation' },
  { symbol: 'ROL',   name: 'Rollins Inc.' },
  { symbol: 'ROP',   name: 'Roper Technologies' },
  { symbol: 'ROST',  name: 'Ross Stores' },
  { symbol: 'RCL',   name: 'Royal Caribbean Group' },
  { symbol: 'SPGI',  name: 'S&P Global Inc.' },
  { symbol: 'CRM',   name: 'Salesforce Inc.' },
  { symbol: 'SBAC',  name: 'SBA Communications' },
  { symbol: 'SLB',   name: 'Schlumberger (SLB)' },
  { symbol: 'STX',   name: 'Seagate Technology' },
  { symbol: 'SRE',   name: 'Sempra Energy' },
  { symbol: 'NOW',   name: 'ServiceNow Inc.' },
  { symbol: 'SHW',   name: 'Sherwin-Williams' },
  { symbol: 'SPG',   name: 'Simon Property Group' },
  { symbol: 'SWKS',  name: 'Skyworks Solutions' },
  { symbol: 'SNA',   name: 'Snap-on Inc.' },
  { symbol: 'SOLV',  name: 'Solventum Corporation' },
  { symbol: 'SO',    name: 'Southern Company' },
  { symbol: 'LUV',   name: 'Southwest Airlines' },
  { symbol: 'SWK',   name: 'Stanley Black & Decker' },
  { symbol: 'SBUX',  name: 'Starbucks Corporation' },
  { symbol: 'STT',   name: 'State Street Corporation' },
  { symbol: 'STLD',  name: 'Steel Dynamics' },
  { symbol: 'STE',   name: 'Steris plc' },
  { symbol: 'SYK',   name: 'Stryker Corporation' },
  { symbol: 'SYF',   name: 'Synchrony Financial' },
  { symbol: 'SNPS',  name: 'Synopsys Inc.' },
  { symbol: 'SYY',   name: 'Sysco Corporation' },
  { symbol: 'TMUS',  name: 'T-Mobile US' },
  { symbol: 'TROW',  name: 'T. Rowe Price' },
  { symbol: 'TTWO',  name: 'Take-Two Interactive' },
  { symbol: 'TPR',   name: 'Tapestry Inc.' },
  { symbol: 'TRGP',  name: 'Targa Resources' },
  { symbol: 'TGT',   name: 'Target Corporation' },
  { symbol: 'TEL',   name: 'TE Connectivity' },
  { symbol: 'TDY',   name: 'Teledyne Technologies' },
  { symbol: 'TFX',   name: 'Teleflex Inc.' },
  { symbol: 'TER',   name: 'Teradyne Inc.' },
  { symbol: 'TSLA',  name: 'Tesla Inc.' },
  { symbol: 'TXN',   name: 'Texas Instruments' },
  { symbol: 'TXT',   name: 'Textron Inc.' },
  { symbol: 'TMO',   name: 'Thermo Fisher Scientific' },
  { symbol: 'TJX',   name: 'TJX Companies' },
  { symbol: 'TSCO',  name: 'Tractor Supply Company' },
  { symbol: 'TT',    name: 'Trane Technologies' },
  { symbol: 'TDG',   name: 'TransDigm Group' },
  { symbol: 'TRV',   name: 'Travelers Companies' },
  { symbol: 'TRMB',  name: 'Trimble Inc.' },
  { symbol: 'TFC',   name: 'Truist Financial' },
  { symbol: 'TYL',   name: 'Tyler Technologies' },
  { symbol: 'TSN',   name: 'Tyson Foods' },
  { symbol: 'USB',   name: 'U.S. Bancorp' },
  { symbol: 'UBER',  name: 'Uber Technologies' },
  { symbol: 'UDR',   name: 'UDR Inc.' },
  { symbol: 'ULTA',  name: 'Ulta Beauty' },
  { symbol: 'UNP',   name: 'Union Pacific' },
  { symbol: 'UAL',   name: 'United Airlines Holdings' },
  { symbol: 'UPS',   name: 'United Parcel Service' },
  { symbol: 'URI',   name: 'United Rentals' },
  { symbol: 'UNH',   name: 'UnitedHealth Group' },
  { symbol: 'UHS',   name: 'Universal Health Services' },
  { symbol: 'VLO',   name: 'Valero Energy' },
  { symbol: 'VTR',   name: 'Ventas Inc.' },
  { symbol: 'VLTO',  name: 'Veralto Corporation' },
  { symbol: 'VRSN',  name: 'VeriSign Inc.' },
  { symbol: 'VRSK',  name: 'Verisk Analytics' },
  { symbol: 'VZ',    name: 'Verizon Communications' },
  { symbol: 'VRTX',  name: 'Vertex Pharmaceuticals' },
  { symbol: 'VICI',  name: 'VICI Properties' },
  { symbol: 'V',     name: 'Visa Inc.' },
  { symbol: 'VST',   name: 'Vistra Corporation' },
  { symbol: 'VMC',   name: 'Vulcan Materials' },
  { symbol: 'WRB',   name: 'W. R. Berkley' },
  { symbol: 'GWW',   name: 'W.W. Grainger' },
  { symbol: 'WAB',   name: 'Wabtec Corporation' },
  { symbol: 'WMT',   name: 'Walmart Inc.' },
  { symbol: 'DIS',   name: 'Walt Disney Company' },
  { symbol: 'WBD',   name: 'Warner Bros. Discovery' },
  { symbol: 'WM',    name: 'Waste Management' },
  { symbol: 'WAT',   name: 'Waters Corporation' },
  { symbol: 'WEC',   name: 'WEC Energy Group' },
  { symbol: 'WELL',  name: 'Welltower Inc.' },
  { symbol: 'WFC',   name: 'Wells Fargo & Company' },
  { symbol: 'WST',   name: 'West Pharmaceutical Services' },
  { symbol: 'WDC',   name: 'Western Digital' },
  { symbol: 'WY',    name: 'Weyerhaeuser' },
  { symbol: 'WSM',   name: 'Williams-Sonoma' },
  { symbol: 'WMB',   name: 'Williams Companies' },
  { symbol: 'WTW',   name: 'Willis Towers Watson' },
  { symbol: 'WYNN',  name: 'Wynn Resorts' },
  { symbol: 'XEL',   name: 'Xcel Energy' },
  { symbol: 'XYL',   name: 'Xylem Inc.' },
  { symbol: 'YUM',   name: 'Yum! Brands' },
  { symbol: 'ZBRA',  name: 'Zebra Technologies' },
  { symbol: 'ZBH',   name: 'Zimmer Biomet' },
  { symbol: 'ZION',  name: 'Zions Bancorporation' },
  { symbol: 'ZTS',   name: 'Zoetis Inc.' },
]

export default function TickerSearch({ onSearch, loading }) {
  const [query, setQuery]             = useState('')
  const [open, setOpen]               = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const inputRef = useRef(null)
  const listRef  = useRef(null)
  const wrapRef  = useRef(null)

  // Filter: symbol prefix match first, then company name contains
  const filtered = query.trim().length === 0
    ? SP500_TICKERS
    : (() => {
        const q = query.trim().toUpperCase()
        const symMatch  = SP500_TICKERS.filter(t => t.symbol.startsWith(q))
        const nameMatch = SP500_TICKERS.filter(
          t => !t.symbol.startsWith(q) && t.name.toUpperCase().includes(q)
        )
        return [...symMatch, ...nameMatch]
      })()

  const commit = useCallback((symbol) => {
    setQuery(symbol)
    setOpen(false)
    setHighlighted(-1)
    onSearch(symbol.trim().toUpperCase())
  }, [onSearch])

  const handleKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlighted >= 0 && filtered[highlighted]) {
        commit(filtered[highlighted].symbol)
      } else if (query.trim()) {
        commit(query.trim().toUpperCase())
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setHighlighted(-1)
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const el = listRef.current.children[highlighted]
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlighted])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setHighlighted(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={wrapRef} className="relative flex gap-2 flex-1 max-w-md">
      {/* Input */}
      <div className="relative flex-1">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            setOpen(true)
            setHighlighted(-1)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search S&P 500 ticker or company…"
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-surface border border-border rounded-lg px-4 py-2 pr-8 text-sm
                     text-slate-200 placeholder-slate-600
                     focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/60"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none select-none text-xs">
          ▾
        </span>
      </div>

      {/* Dropdown */}
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute top-full left-0 z-50 mt-1 w-full max-h-72 overflow-y-auto
                     bg-card border border-border rounded-lg shadow-xl text-sm"
        >
          {filtered.map((t, i) => (
            <li
              key={t.symbol}
              onMouseDown={(e) => { e.preventDefault(); commit(t.symbol) }}
              onMouseEnter={() => setHighlighted(i)}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors
                ${i === highlighted
                  ? 'bg-emerald-600/20 text-slate-100'
                  : 'text-slate-300 hover:bg-white/[0.04]'
                }`}
            >
              <span className="font-mono font-semibold text-emerald-400 w-16 shrink-0">
                {t.symbol}
              </span>
              <span className="text-slate-400 truncate">{t.name}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Search button */}
      <button
        type="button"
        disabled={loading}
        onClick={() => query.trim() && commit(query.trim().toUpperCase())}
        className="px-5 py-2 rounded-lg text-sm font-semibold
                   bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40
                   transition-colors whitespace-nowrap"
      >
        {loading ? 'Loading…' : 'Search'}
      </button>
    </div>
  )
}
