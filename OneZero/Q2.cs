namespace OneZero
{
    class Q2
    {
        public static int FindMaxSum(List<int> list)
        {
            if (list == null || list.Count == 0) return 0;
            if (list.Count == 1) return list[0];

            // 初始化前兩個最大值，確保 max1 >= max2
            int max1 = Math.Max(list[0], list[1]);
            int max2 = Math.Min(list[0], list[1]);

            // 從第三個元素開始遍歷一次
            for (int i = 2; i < list.Count; i++)
            {
                int current = list[i];

                if (current > max1)
                {
                    max2 = max1; // 原本的第一名退居第二
                    max1 = current; // 更新第一名
                }
                else if (current > max2)
                {
                    max2 = current; // 更新第二名
                }
            }

            return max1 + max2;
        }

    }
}