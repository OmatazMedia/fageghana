<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TradeOpportunity extends Model
{
    protected $table = 'trade_opportunities';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['title', 'slug', 'description', 'country', 'sector', 'requirements', 'deadline', 'source_url', 'source_name', 'is_public', 'status', 'published_at', 'tags'];


    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = \Illuminate\Support\Str::uuid()->toString();
            }
        });
    }
}
