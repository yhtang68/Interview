namespace OneZero
{
    public class Q1
    {
        public static Tuple<int, int> GetClosingPricesIndex(List<int> list, int target)
        {
            if (list == null || list.Count < 2) return null;

            // Key: 數字的值, Value: 該數字第一次出現的索引
            var map = new Dictionary<int, int>();

            for (int i = 0; i < list.Count; i++)
            {
                int current = list[i];

                // 根據 Math.Abs(A - B) == target，當前數字 current 对应的目標數字可能有兩種：
                // 1. current - x = target  => x = current - target
                // 2. x - current = target  => x = current + target
                int complement1 = current - target;
                int complement2 = current + target;

                if (map.TryGetValue(complement1, out int index1))
                {
                    return Tuple.Create(index1, i);
                }

                if (map.TryGetValue(complement2, out int index2))
                {
                    return Tuple.Create(index2, i);
                }

                // 唯有當字典裡不存在該數字時才加入，確保回傳的是最早出現的索引
                if (!map.ContainsKey(current))
                {
                    map[current] = i;
                }
            }

            return null;
        }

    }
}