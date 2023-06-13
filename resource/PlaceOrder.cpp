struct HardCodedInContract
{
	string TradepoolAddress[20]; // Assume no more than 20 pools defined in the contract
	int PoolType[20];
}

struct Input
{
	int NumberOfPaths;			// How many paths are to be considered by the smart contract
	int Path[3][5];					// At most three paths are provided; each path length can be at most 5; the paths need to be fairly independent from each other
	int PathLength[3];			// Lengths of the paths
	double SlippageRate[3]; // Pre-calculate the slippage rate of each path that is provided from off-chain
	double MinOrderSize[3]; // The minimum order size that can be placed for a certain path

	int OrderDirection; // The From token0 to token1 or from token1 to toke0 - +1 as for token0 to token1; -1 as for token1 to token0
	//相当于路径价格
	double ReferencePrice;		// The best pool's spot price as of order placement from offline; measured as "One token0 exchange to how many token1"
	double ReferenceNotional; // The Initial order notional instructed by off-chain

	double GreenLightSlippageThreshold; // Allowed slippage that an order can be placed right away, for example, 0.1%
	//滑点大于这个值的部分就不下了,相当于计算最大下单量的参数
	double CutoffSlippageThreshold; // Worst slippage tolerance, above which additional notionals make no sense. For example, 0.5%, or can be changed depending on size of opportunity
}

int
DecodeInput()
{
	Decode the input;
	return 0
};

double OnchainSpotPrice(int PathNumber, int OrderDirection)
{
	return OnchainSpotPrice;
};

int PlaceOrder(int PathNumber, int OrderDirection, int OrderNotional) // OrderNotional in Token0
		{
				Place an order};

// Sort from min to max; othereise opposite		//If it makes it easier, we can assume Length==3
int Sort(double MarketAdverseShift[], int RankingMap[], int Length){
		// Sort the array MarketAdverseShift from min to max and the sorting info should be in the RankingMap.
		// For example, if MarketAdverseShift[2]<MarketAdverseShift[0]<MarketAdverseShift[1], RankingMap's element should be [2,0,1]
		return 0};

int Trade()
{
	DecodeInput;
	double SpotPrice[3];
	double MarketAdverseShift[3]; //糟糕方向的移动
	double MaxNotional = 0;
	int RankingMap[3];
	int LiquidityCapacity[3];
	int RangeDepth;
	double OrderNotional[3];
	bool CheckFinished = false;
	double RemainingNotional;
	double ReverseSlippageRate[3];
	double TotalReverseSlippageRate;

	// First, if the first choice is above the GreenLightSlippageThreshold, just move forward to place order without further checks!
	SpotPrice[0] = OnchainSpotPrice(0, OrderDirection);
	MarketAdverseShift[0] = (ReferencePrice / SpotPrice[0] - 1) * OrderDirection;
	if (MarketAdverseShift[0] + SlippageRate[0] * ReferenceNotional < GreenLightSlippageThreshold)
	{
		PlaceOrder(0, OrderDirection, ReferenceNotional);
	}
	else
	{
		if (NumberOfPaths == 1) // Only ONE path needs to be considered
		{
			//计算最优下单量
			MaxNotional = min((CutoffSlippageThreshold - MarketAdverseShift[0]) / SlippageRate[0] / 2, ReferenceNotional);
			if (MaxNotional >= MinOrderSize[0])
			{
				PlaceOrder(0, OrderDirection, MaxNotional);
			};
		}
		else // Multiple paths should be considered - that means there are paths with close prices and decent liquidities
		{
			//计算滑点率的倒数
			for (i = 0 to 2, i++)
				ReverseSlippageRate[i] = 1 / SlippageRate[i];

			// Need extra gas!
			SpotPrice[1] = OnchainSpotPrice(1, OrderDirection);
			SpotPrice[2] = OnchainSpotPrice(2, OrderDirection);

			// This shows the distance (in percentage) of the spot prices from the Reference Price
			MarketAdverseShift[1] = (ReferencePrice / SpotPrice[1] - 1) * OrderDirection;
			MarketAdverseShift[2] = (ReferencePrice / SpotPrice[2] - 1) * OrderDirection;

			// Now that there are only three paths, we can write the code in a manual way rather than a looping way.
			Sort(MarketAdverseShift, RankingMap, 3);

			// If even the best pool is quite far away. Just brake.
			if (!(MarketAdverseShift[RankingMap[0]] > CutoffSlippageThreshold))
			{
				// Initialize Order Notional
				for (i = 0 to 2, i++)
					OrderNotional[i] = 0;

				RemainingNotional = ReferenceNotional;

				// First,consider the range from MarketAdverseShift[RankingMap[0]] to MarketAdverseShift[RankingMap[1]]
				if (MarketAdverseShift[RankingMap[1]] > CutoffSlippageThreshold)
				{
					// Only need to consider placing order to the best pool
					MaxNotional = min((CutoffSlippageThreshold - MarketAdverseShift[RankingMap[0]]) / 2 * ReverseSlippageRate[RankingMap[0]], RemainingNotional);
					OrderNotional[RankingMap[0]] = MaxNotional;
					CheckFinished = true;
				}
				else
				{
					MaxNotional = min((MarketAdverseShift[RankingMap[1]] - MarketAdverseShift[RankingMap[0]]) / 2 * ReverseSlippageRate[RankingMap[0]], RemainingNotional);
					if (abs(MaxNotional - RemainingNotional) < Epsilon) // Can finish order placement with one go
					{
						OrderNotional[RankingMap[0]] = MaxNotional;
						CheckFinished = true;
					}
					else
					{
						OrderNotional[RankingMap[0]] = MaxNotional;
						RemainingNotional -= MaxNotional;
					};
				};

				if ((!(CheckFinished)) && RemainingNotional > Epsilon)
				{
					// Then consider the range from MarketAdverseShift[RankingMap[1]] to MarketAdverseShift[RankingMap[2]]
					TotalReverseSlippageRate = ReverseSlippageRate[RankingMap[0]] + ReverseSlippageRate[RankingMap[1]];
					if (MarketAdverseShift[RankingMap[2]] > CutoffSlippageThreshold)
					{
						MaxNotional = min((CutoffSlippageThreshold - MarketAdverseShift[RankingMap[1]]) / 2 * TotalReverseSlippageRate, RemainingNotional);
						OrderNotional[RankingMap[0]] += MaxNotional * ReverseSlippageRate[RankingMap[0]] / TotalReverseSlippageRate;
						OrderNotional[RankingMap[1]] += MaxNotional * ReverseSlippageRate[RankingMap[1]] / TotalReverseSlippageRate;
						CheckFinished = true;
					}
					else
					{
						MaxNotional = min((MarketAdverseShift[RankingMap[2]] - MarketAdverseShift[RankingMap[1]]) / 2 * TotalReverseSlippageRate, RemainingNotional);
						OrderNotional[RankingMap[0]] += MaxNotional * ReverseSlippageRate[RankingMap[0]] / TotalReverseSlippageRate;
						OrderNotional[RankingMap[1]] += MaxNotional * ReverseSlippageRate[RankingMap[1]] / TotalReverseSlippageRate;
						RemainingNotional -= MaxNotional;
					};
				};

				if ((!(CheckFinished)) && RemainingNotional > Epsilon)
				{
					// Then consider the range outside of MarketAdverseShift[RankingMap[2]]
					TotalReverseSlippageRate = ReverseSlippageRate[RankingMap[0]] + ReverseSlippageRate[RankingMap[1]] + ReverseSlippageRate[RankingMap[2]];
					MaxNotional = min((CutoffSlippageThreshold - MarketAdverseShift[RankingMap[2]]) / 2 * TotalReverseSlippageRate, RemainingNotional);
					OrderNotional[RankingMap[0]] += MaxNotional * ReverseSlippageRate[RankingMap[0]] / TotalReverseSlippageRate;
					OrderNotional[RankingMap[1]] += MaxNotional * ReverseSlippageRate[RankingMap[1]] / TotalReverseSlippageRate;
					OrderNotional[RankingMap[2]] += MaxNotional * ReverseSlippageRate[RankingMap[2]] / TotalReverseSlippageRate;
					CheckFinished = true;
				};
				for (i = 0 to 3, i++)
				{
					if(OrderNotional[i] > MinOrderSize[i]
						PlaceOrder(i, OrderDirection, OrderNotional[i];
				};
			};
		};
	};
	return 0;
}
