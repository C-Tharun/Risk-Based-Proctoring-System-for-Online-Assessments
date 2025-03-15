INSERT INTO "public"."questions" ("id", "question", "type", "options", "correct_answer", "starting_code", "test_cases", "created_at", "updated_at") VALUES ('5', 'What is the time complexity of binary search?', 'mcq', '["O(n)","O(log n)","O(n log n)","O(n²)"]', 'O(log n)', null, null, '2025-03-15 17:02:37.364418+00', '2025-03-15 17:02:37.364418+00'), ('6', 'Which data structure follows the Last In First Out (LIFO) principle?', 'mcq', '["Queue","Stack","Linked List","Binary Tree"]', 'Stack', null, null, '2025-03-15 17:02:37.364418+00', '2025-03-15 17:02:37.364418+00'), ('7', 'Two Sum Problem

Given an array of integers nums and an integer target, return indices of the two numbers in nums such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.

Example 1:
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].

Example 2:
Input: nums = [3,2,4], target = 6
Output: [1,2]
Explanation: Because nums[1] + nums[2] == 6, we return [1, 2].

Constraints:
• 2 <= nums.length <= 104
• -109 <= nums[i] <= 109
• -109 <= target <= 109
• Only one valid answer exists

Follow-up: Can you come up with an algorithm that is less than O(n²) time complexity?', 'coding', null, null, '/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function twoSum(nums, target) {
    // Write your solution here
    
}', '[{"input":[[2,7,11,15],9],"explanation":"nums[0] + nums[1] = 2 + 7 = 9","expectedOutput":[0,1]},{"input":[[3,2,4],6],"explanation":"nums[1] + nums[2] = 2 + 4 = 6","expectedOutput":[1,2]},{"input":[[3,3],6],"explanation":"nums[0] + nums[1] = 3 + 3 = 6","expectedOutput":[0,1]}]', '2025-03-15 17:02:37.364418+00', '2025-03-15 17:02:37.364418+00'), ('8', 'Valid Parentheses

Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

Example 1:
Input: s = "()"
Output: true
Explanation: Single pair of valid parentheses.

Example 2:
Input: s = "()[]{}"
Output: true
Explanation: Each opening bracket is closed by the same type.

Example 3:
Input: s = "(]"
Output: false
Explanation: The close bracket ']' cannot match with open bracket '('.

Constraints:
• 1 <= s.length <= 104
• s consists of parentheses only '()[]{}'', 'coding', null, null, '/**
 * @param {string} s
 * @return {boolean}
 */
function isValid(s) {
    // Write your solution here
    
}', '[{"input":["()"],"explanation":"Simple valid pair of parentheses","expectedOutput":true},{"input":["()[]{}"],"explanation":"Multiple valid pairs","expectedOutput":true},{"input":["(]"],"explanation":"Mismatched brackets","expectedOutput":false},{"input":["([)]"],"explanation":"Incorrectly ordered closing brackets","expectedOutput":false},{"input":["{[]}"],"explanation":"Nested brackets closed in correct order","expectedOutput":true}]', '2025-03-15 17:02:37.364418+00', '2025-03-15 17:02:37.364418+00');