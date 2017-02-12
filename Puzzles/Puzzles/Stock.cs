using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Puzzles
{
    class Stock
    {
        public int GetMaxProfit(int[] stockPricesYesterday)
        {
            // Make sure we have at least 2 prices
            if (stockPricesYesterday.Length < 2)
            {
                throw new ArgumentException("Getting a profit requires at least 2 prices",
                    nameof(stockPricesYesterday));
            }

            // We'll greedily update minPrice and maxProfit, so we initialize
            // them to the first price and the first possible profit
            int minPrice = stockPricesYesterday[0];
            int maxProfit = stockPricesYesterday[1] - stockPricesYesterday[0];

            // Start at the second (index 1) time.
            // We can't sell at the first time, since we must buy first,
            // and we can't buy and sell at the same time!
            // If we started at index 0, we'd try to buy *and* sell at time 0.
            // This would give a profit of 0, which is a problem if our
            // maxProfit is supposed to be *negative*--we'd return 0!
            for (int i = 1; i < stockPricesYesterday.Length; i++)
            {
                int currentPrice = stockPricesYesterday[i];

                // See what our profit would be if we bought at the
                // min price and sold at the current price
                int potentialProfit = currentPrice - minPrice;

                // Update maxProfit if we can do better
                maxProfit = Math.Max(maxProfit, potentialProfit);

                // Update minPrice so it's always
                // the lowest price we've seen so far
                minPrice = Math.Min(minPrice, currentPrice);
            }

            return maxProfit;
        }

    }
}