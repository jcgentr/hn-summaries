import { generateSummaryAndTags } from "@/lib/ai";
import { createClient } from "@/utils/supabase/server";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    const supabase = await createClient();
    const { data: existingArticle } = await supabase
      .from("articles")
      .select()
      .eq("url", url)
      .single();

    if (existingArticle) {
      return NextResponse.json(existingArticle, { status: 200 });
    }

    // If article doesn't exist, fetch and create it
    const response = await fetch(url);
    const html = await response.text();

    const doc = new JSDOM(html, { url });
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    if (!article) {
      return NextResponse.json(
        { error: "Failed to parse article" },
        { status: 500 }
      );
    }

    const wordCount = article.textContent.trim().split(/\s+/).length;
    const cleanContent = article.textContent.replace(/\s+/g, " ").trim();
    const result = await generateSummaryAndTags(cleanContent, wordCount);

    // Insert into articles table
    const { data: newArticle, error: articleError } = await supabase
      .from("articles")
      .insert({
        url,
        title: article.title,
        author: article.byline,
        published_time: article.publishedTime,
        content: cleanContent,
        formatted_content: article.content,
        word_count: wordCount,
        summary: result.summary,
        tags: result.tags,
      })
      .select()
      .single();

    if (articleError || !newArticle) {
      console.log(articleError);
      return NextResponse.json(
        { error: `Failed to create article: ${articleError?.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(newArticle, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create article summary" },
      { status: 500 }
    );
  }
}
