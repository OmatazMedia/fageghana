<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TradeMatch extends Model
{
    protected $table = 'trade_matches';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['trade_opportunity_id', 'member_id', 'matched_at', 'notified', 'status', 'notes'];


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
